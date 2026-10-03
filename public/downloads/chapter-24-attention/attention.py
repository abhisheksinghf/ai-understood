"""Inspect exact two-head attention arithmetic; no training or network access."""
import argparse
import json
import math
from pathlib import Path

DATA = json.loads((Path(__file__).parent / "data.json").read_text(encoding="utf-8"))


def dot(a, b):
    return sum(x*y for x, y in zip(a, b))


def project(row, matrix):
    return [sum(x*matrix[i][j] for i, x in enumerate(row)) for j in range(len(matrix[0]))]


def position(index, width=4):
    return [(math.sin if i % 2 == 0 else math.cos)(index/10000**(2*(i//2)/width)) for i in range(width)]


def softmax(scores):
    allowed = [x for x in scores if x is not None]
    if not allowed:
        raise ValueError("At least one key must be visible.")
    maximum = max(allowed)
    exps = [0.0 if x is None else math.exp(x-maximum) for x in scores]
    total = sum(exps)
    return [x/total for x in exps]


def attend(inputs, head, causal=True):
    q, k, v = [[project(row, head[name]) for row in inputs] for name in ("Wq", "Wk", "Wv")]
    raw = [[dot(query, key) for key in k] for query in q]
    scaled = [[x/math.sqrt(len(q[0])) for x in row] for row in raw]
    masked = [[None if causal and j > i else x for j, x in enumerate(row)] for i, row in enumerate(scaled)]
    weights = [softmax(row) for row in masked]
    outputs = [[sum(w*v[j][d] for j, w in enumerate(row)) for d in range(len(v[0]))] for row in weights]
    return {"Q": q, "K": k, "V": v, "raw": raw, "scaled": scaled, "masked": masked, "weights": weights, "outputs": outputs}


def explore(ending="fun", positions="none", causal=True):
    if ending not in ("fun", "slow") or positions not in ("none", "sinusoidal") or not isinstance(causal, bool):
        raise ValueError("Use ending fun/slow, positions none/sinusoidal, and a boolean causal mask.")
    tokens = [*DATA["tokens"][:3], ending]
    embeddings = [list(DATA["embeddings"][t]) for t in tokens]
    positional = [position(i) if positions == "sinusoidal" else [0, 0, 0, 0] for i in range(4)]
    inputs = [[x+positional[i][d] for d, x in enumerate(row)] for i, row in enumerate(embeddings)]
    heads = [{"name": h["name"], **attend(inputs, h, causal)} for h in DATA["heads"]]
    concatenated = [heads[0]["outputs"][i]+heads[1]["outputs"][i] for i in range(4)]
    projected = [project(row, DATA["Wo"]) for row in concatenated]
    residual = [[x+projected[i][d] for d, x in enumerate(row)] for i, row in enumerate(inputs)]
    return {"ending": ending, "positions": positions, "causal": causal, "tokens": tokens, "embeddings": embeddings, "positional": positional, "inputs": inputs, "heads": heads, "concatenated": concatenated, "projected": projected, "residual": residual, "allowed_pairs": 10 if causal else 16}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ending", choices=("fun", "slow"), default="fun")
    parser.add_argument("--positions", choices=("none", "sinusoidal"), default="none")
    parser.add_argument("--mask", choices=("causal", "bidirectional"), default="causal")
    args = parser.parse_args()
    print(json.dumps(explore(args.ending, args.positions, args.mask == "causal"), indent=2, allow_nan=False))
