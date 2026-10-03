"""Inspect toy cross-modal matching and video evidence. Python 3.10+, stdlib only.

Vectors and scene annotations are hand-set. No OCR, ASR, vision model or API runs.
"""
import argparse
import json
import math
from pathlib import Path

DATA = json.loads(Path(__file__).with_name('data.json').read_text(encoding='utf-8'))


def cosine(a, b):
    if (not isinstance(a, (list, tuple)) or not isinstance(b, (list, tuple))
            or not a or len(a) != len(b)
            or any(not isinstance(v, (int, float)) or not math.isfinite(v) for v in [*a, *b])):
        raise ValueError('Invalid vectors.')
    na, nb = math.hypot(*a), math.hypot(*b)
    if not na or not nb:
        raise ValueError('Zero vectors have no cosine direction.')
    return sum((x/na)*(y/nb) for x, y in zip(a, b))


def match(query='calm', space='aligned', temperature=0.5, candidates='all'):
    q = next((q for q in DATA['queries'] if q['id'] == query), None)
    if (q is None or space not in ['aligned', 'mismatched']
            or temperature not in [0.1, 0.5, 1] or candidates not in DATA['candidateSets']):
        raise ValueError('Invalid matching configuration.')
    rows = []
    for poster in DATA['posters']:
        if poster['id'] not in DATA['candidateSets'][candidates]:
            continue
        x, y, z = poster['vector']
        vector = [x, y, z] if space == 'aligned' else [z, x, y]
        rows.append(dict(id=poster['id'], title=poster['title'], vector=vector,
                         score=cosine(q['vector'], vector)))
    peak = max(row['score']/temperature for row in rows)
    weights = [math.exp(row['score']/temperature-peak) for row in rows]
    for row, weight in zip(rows, weights):
        row['share'] = weight/sum(weights)
    rows.sort(key=lambda row: (-row['score'], row['id']))
    return dict(config=dict(query=query, space=space, temperature=temperature, candidates=candidates),
                queryText=q['text'], queryVector=q['vector'][:], rows=rows, winner=rows[0]['id'])


def patch_count(width, height, patch=16):
    if (any(not isinstance(v, int) or v <= 0 for v in [width, height, patch])
            or width % patch or height % patch):
        raise ValueError('Use positive integer dimensions divisible by the patch size.')
    return width//patch*(height//patch)


def sample_video(interval=4, phase=0, resolution=224, align_audio=True):
    if (interval not in [1, 2, 4, 5] or phase not in [0, 0.25, 0.5, 0.75]
            or resolution not in [224, 448] or not isinstance(align_audio, bool)):
        raise ValueError('Invalid sampling configuration.')
    trailer = DATA['trailer']
    frames = []
    time = phase*interval
    while time < trailer['duration']:
        scene = next(s for s in trailer['scenes'] if s['start'] <= time < s['end'])
        frames.append(dict(time=time, scene=scene['label'], caption=scene['caption'],
                           event=trailer['event']['start'] <= time < trailer['event']['end']))
        time += interval
    hit_times = [f['time'] for f in frames if f['event']]
    audio = trailer['audio']
    offset = audio['sourceOffset'] if align_audio else 0
    start, end = audio['localStart']+offset, audio['localEnd']+offset
    return dict(config=dict(interval=interval, phase=phase, resolution=resolution, alignAudio=align_audio),
                frames=frames, hitTimes=hit_times, observed=bool(hit_times),
                patchesPerFrame=patch_count(resolution, resolution),
                totalPatches=len(frames)*patch_count(resolution, resolution),
                audio=dict(start=start, end=end, text=audio['text'], correctlyMapped=align_audio,
                           overlapFrames=[f['time'] for f in frames if start <= f['time'] < end]))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--query', choices=[q['id'] for q in DATA['queries']], default='calm')
    parser.add_argument('--space', choices=['aligned', 'mismatched'], default='aligned')
    parser.add_argument('--temperature', type=float, choices=[0.1, 0.5, 1], default=0.5)
    parser.add_argument('--candidates', choices=list(DATA['candidateSets']), default='all')
    parser.add_argument('--interval', type=int, choices=[1, 2, 4, 5], default=4)
    parser.add_argument('--phase', type=float, choices=[0, 0.25, 0.5, 0.75], default=0)
    parser.add_argument('--resolution', type=int, choices=[224, 448], default=224)
    parser.add_argument('--align-audio', action=argparse.BooleanOptionalAction, default=True)
    args = parser.parse_args()
    print(json.dumps(dict(matching=match(args.query, args.space, args.temperature, args.candidates),
                         video=sample_video(args.interval, args.phase, args.resolution, args.align_audio)), indent=2))


if __name__ == '__main__':
    main()
