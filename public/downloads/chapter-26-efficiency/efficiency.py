"""Chapter 26: memory arithmetic and a deterministic scalar quantizer. No model runs."""
import argparse
import json
import math
from pathlib import Path

DATA = json.loads(Path(__file__).with_name('data.json').read_text(encoding='utf-8'))
GIB = 2**30


def memory(weight_bits=16, kv_heads=8, cache_bits=16, batch=1, tokens=4096, budget=16):
    choices = ((weight_bits, (4, 8, 16)), (kv_heads, (1, 8, 32)), (cache_bits, (8, 16)),
               (batch, (1, 4, 8)), (tokens, (1024, 4096, 8192)), (budget, (8, 16, 24)))
    if any(value not in allowed for value, allowed in choices):
        raise ValueError('Unsupported memory configuration.')
    weights_bytes = DATA['parameters'] * weight_bits / 8
    cache_per_token = 2 * DATA['layers'] * kv_heads * DATA['head_dimension'] * cache_bits / 8
    cache_bytes = batch * tokens * cache_per_token
    reserve_bytes = DATA['reserve_gib'] * GIB
    budget_bytes = budget * GIB
    total_bytes = weights_bytes + cache_bytes + reserve_bytes
    return {
        'config': dict(weightBits=weight_bits, kvHeads=kv_heads, cacheBits=cache_bits,
                       batch=batch, tokens=tokens, budget=budget),
        'parameters': DATA['parameters'], 'layers': DATA['layers'],
        'queryHeads': DATA['query_heads'], 'headDimension': DATA['head_dimension'],
        'weightsBytes': weights_bytes, 'cachePerToken': cache_per_token,
        'cacheBytes': cache_bytes, 'reserveBytes': reserve_bytes, 'totalBytes': total_bytes,
        'budgetBytes': budget_bytes, 'headroomBytes': budget_bytes-total_bytes,
        'withinEstimate': total_bytes <= budget_bytes,
        'gib': dict(weights=weights_bytes/GIB, cache=cache_bytes/GIB,
                    reserve=DATA['reserve_gib'], total=total_bytes/GIB,
                    headroom=(budget_bytes-total_bytes)/GIB),
        'maxSequences': max(0, math.floor((budget_bytes-weights_bytes-reserve_bytes)/(tokens*cache_per_token)))
    }


def round_away(x):
    return (1 if x > 0 else -1 if x < 0 else 0) * math.floor(abs(x)+0.5)


def quantize(weights, bits=4, group_size=None):
    group_size = len(weights) if group_size is None else group_size
    if bits not in (4, 8) or not isinstance(group_size, int) or group_size < 1 or not weights or any(not math.isfinite(w) for w in weights):
        raise ValueError('Invalid quantization inputs.')
    qmax = 2**(bits-1)-1
    rows, scales = [], []
    for start in range(0, len(weights), group_size):
        chunk = weights[start:start+group_size]
        peak = max(abs(w) for w in chunk)
        scale = 1 if peak == 0 else peak/qmax
        scales.append(scale)
        for j, original in enumerate(chunk):
            code = max(-qmax, min(qmax, round_away(original/scale)))
            restored = code*scale
            rows.append(dict(index=start+j, group=len(scales), original=original,
                             scale=scale, code=code, restored=restored, error=restored-original))
    payload_bytes = math.ceil(len(weights)*bits/8)
    scale_bytes = len(scales)*4
    return dict(bits=bits, groupSize=group_size, qmax=qmax, scales=scales, rows=rows,
                mae=sum(abs(r['error']) for r in rows)/len(weights),
                maxError=max(abs(r['error']) for r in rows), payloadBytes=payload_bytes,
                scaleBytes=scale_bytes, totalBytes=payload_bytes+scale_bytes, fp32Bytes=len(weights)*4)


def compression(preset='balanced', bits=4, grouping='tensor'):
    if preset not in DATA['weights'] or grouping not in ('tensor', 'pairs'):
        raise ValueError('Invalid compression configuration.')
    weights, features = DATA['weights'][preset], DATA['features']
    q = quantize(weights, bits, len(weights) if grouping == 'tensor' else 2)
    original = sum(w*x for w, x in zip(weights, features))
    restored = sum(r['restored']*x for r, x in zip(q['rows'], features))
    return dict(preset=preset, grouping=grouping, **q, features=features,
                originalScore=original, restoredScore=restored, scoreChange=restored-original)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for flag, choices, default in [('weight-bits', [4, 8, 16], 16), ('kv-heads', [1, 8, 32], 8),
                                 ('cache-bits', [8, 16], 16), ('batch', [1, 4, 8], 1),
                                 ('tokens', [1024, 4096, 8192], 4096), ('budget', [8, 16, 24], 16),
                                 ('quant-bits', [4, 8], 4)]:
        parser.add_argument('--'+flag, type=int, choices=choices, default=default)
    parser.add_argument('--preset', choices=['balanced', 'outlier'], default='balanced')
    parser.add_argument('--grouping', choices=['tensor', 'pairs'], default='tensor')
    args = parser.parse_args()
    print(json.dumps(dict(memory=memory(args.weight_bits, args.kv_heads, args.cache_bits, args.batch, args.tokens, args.budget),
                          compression=compression(args.preset, args.quant_bits, args.grouping)), indent=2))


if __name__ == '__main__':
    main()
