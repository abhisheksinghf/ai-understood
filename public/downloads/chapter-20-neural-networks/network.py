"""A tiny neural network with manual backpropagation; Python standard library only.

All four fictional movie rows are training data. Results are not test metrics.
Parameter order: hidden units [w1, w2, bias] each, then [v1, v2, v3, output_bias].
The linear baseline instead uses [w1, w2, bias].
"""
import argparse
import json
import math

MOVIES = [
    {"id": "N1", "title": "Moonlight Trail", "x": [1, 0], "y": 1},
    {"id": "N2", "title": "Letters at Dawn", "x": [0, 1], "y": 1},
    {"id": "N3", "title": "Hearts on the Run", "x": [1, 1], "y": 0},
    {"id": "N4", "title": "Quiet Notebook", "x": [0, 0], "y": 0},
]


def initial(architecture="hidden"):
    if architecture == "linear":
        return [0.3, -0.2, 0.1]
    if architecture == "hidden":
        return [0.6, -0.4, 0.1, -0.3, 0.8, -0.2, 0.7, 0.5, 0.05, 0.4, -0.5, 0.3, -0.1]
    raise ValueError("Architecture must be linear or hidden.")


def sigmoid(z):
    if z >= 0:
        return 1 / (1 + math.exp(-z))
    ez = math.exp(z)
    return ez / (1 + ez)


def log_loss(z, y):
    # Stable binary cross-entropy from logits, without rounding/clipping p.
    return max(z, 0) - z * y + math.log1p(math.exp(-abs(z)))


def forward(theta, x):
    if len(theta) not in (3, 13) or not all(math.isfinite(v) for v in theta):
        raise ValueError("Expected 3 or 13 finite parameters.")
    if len(x) != 2 or not all(math.isfinite(v) for v in x):
        raise ValueError("Expected two finite input values.")
    a = [] if len(theta) == 3 else [theta[3*j]*x[0] + theta[3*j+1]*x[1] + theta[3*j+2] for j in range(3)]
    h = [math.tanh(v) for v in a]
    z = theta[0]*x[0] + theta[1]*x[1] + theta[2] if len(theta) == 3 else sum((h[j]*theta[9+j] for j in range(3)), theta[12])
    return {"a": a, "h": h, "z": z, "p": sigmoid(z)}


def sample_gradient(theta, x, y):
    if y not in (0, 1):
        raise ValueError("Label must be 0 or 1.")
    f = forward(theta, x)
    d = f["p"] - y
    g = [0.0] * len(theta)
    if len(theta) == 3:
        g = [d*x[0], d*x[1], d]
    else:
        for j in range(3):
            dh = d * theta[9+j] * (1 - f["h"][j]**2)
            g[3*j], g[3*j+1], g[3*j+2] = dh*x[0], dh*x[1], dh
            g[9+j] = d * f["h"][j]
        g[12] = d
    return {"loss": log_loss(f["z"], y), "gradient": g, **f}


def batch(theta):
    rows = [{**m, **sample_gradient(theta, m["x"], m["y"])} for m in MOVIES]
    gradient = [sum(r["gradient"][i] for r in rows) / len(rows) for i in range(len(theta))]
    for r in rows:
        del r["gradient"]
        r["predicted"] = int(r["p"] >= 0.5)
    return {"loss": sum(r["loss"] for r in rows)/len(rows),
            "accuracy": sum(r["predicted"] == r["y"] for r in rows)/len(rows),
            "gradient": gradient, "rows": rows}


def update(theta, gradient, rate):
    if not math.isfinite(rate) or not 0 < rate <= 2:
        raise ValueError("Learning rate must be greater than 0 and at most 2.")
    if len(theta) != len(gradient) or not all(math.isfinite(v) for v in gradient):
        raise ValueError("Invalid gradient.")
    return [v-rate*g for v, g in zip(theta, gradient)]


def train(architecture="hidden", steps=0, rate=0.5):
    if type(steps) is not int or not 0 <= steps <= 2000:
        raise ValueError("Steps must be an integer from 0 to 2000.")
    theta = initial(architecture)
    update(theta, [0]*len(theta), rate)
    history = []
    for i in range(steps+1):
        result = batch(theta)
        if i % 20 == 0 or i == steps:
            history.append({"step": i, "loss": result["loss"]})
        if i == steps:
            return {"architecture": architecture, "steps": steps, "rate": rate,
                    "parameter_count": len(theta), "theta": theta, **result, "history": history}
        # Compute every derivative using the same old parameters, then update together.
        theta = update(theta, result["gradient"], rate)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--architecture", choices=["hidden", "linear"], default="hidden")
    parser.add_argument("--steps", type=int, default=2000)
    parser.add_argument("--rate", type=float, default=0.5)
    args = parser.parse_args()
    try:
        print(json.dumps(train(args.architecture, args.steps, args.rate), indent=2, allow_nan=False))
    except ValueError as exc:
        parser.error(str(exc))


if __name__ == "__main__":
    main()
