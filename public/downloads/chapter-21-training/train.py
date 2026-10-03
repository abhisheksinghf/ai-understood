"""Chapter 21: real training diagnostics, using only the Python standard library.

Every score is training or development-validation performance. No test set exists.
Presets isolate one change from baseline. Biases are excluded from L2.
"""
import argparse
import json
import math
from pathlib import Path

WIDTH = 8
PRESETS = {
    "baseline": {"label": "Scaled + Adam", "scale": True, "init": "xavier", "optimizer": "adam", "rate": 0.03, "l2": 0},
    "raw": {"label": "Unscaled inputs", "scale": False, "init": "xavier", "optimizer": "adam", "rate": 0.03, "l2": 0},
    "zero": {"label": "All-zero initialization", "scale": True, "init": "zero", "optimizer": "adam", "rate": 0.03, "l2": 0},
    "fast": {"label": "Large Adam learning rate", "scale": True, "init": "xavier", "optimizer": "adam", "rate": 1, "l2": 0},
    "regularized": {"label": "L2-regularized Adam", "scale": True, "init": "xavier", "optimizer": "adam", "rate": 0.03, "l2": 0.02},
    "sgd": {"label": "Plain gradient descent", "scale": True, "init": "xavier", "optimizer": "sgd", "rate": 0.03, "l2": 0},
}


def rng(seed):
    state = seed
    def random():
        nonlocal state
        state = (1664525 * state + 1013904223) % 4294967296
        return state / 4294967296
    return random


def initialize(mode="xavier"):
    if mode == "zero":
        return [0.0] * (4*WIDTH+1)
    if mode != "xavier":
        raise ValueError("Unknown initialization.")
    random = rng(42)
    limit = math.sqrt(6/(2+WIDTH))
    theta = []
    for _ in range(WIDTH):
        theta.extend([(2*random()-1)*limit, (2*random()-1)*limit, 0.0])
    limit = math.sqrt(6/(WIDTH+1))
    theta.extend([(2*random()-1)*limit for _ in range(WIDTH)])
    return theta + [0.0]


def validate(data):
    if not isinstance(data, dict):
        raise ValueError("Expected a dataset object.")
    seen = set()
    for split in ("train", "validation"):
        if not isinstance(data.get(split), list) or not data[split]:
            raise ValueError("Both train and validation must be nonempty lists.")
        for row in data[split]:
            if not isinstance(row, dict):
                raise ValueError("Expected row objects.")
            if not isinstance(row.get("id"), str) or not row["id"] or row["id"] in seen:
                raise ValueError("Rows need unique nonempty IDs across splits.")
            seen.add(row["id"])
            if not isinstance(row.get("x"), list) or len(row["x"]) != 2 or any(type(v) not in (int, float) or not math.isfinite(v) for v in row["x"]):
                raise ValueError("Each row needs two finite numerical features.")
            if type(row.get("y")) is not int or row["y"] not in (0, 1):
                raise ValueError("Labels must be integer 0 or 1.")


def fit_scaler(rows, enabled=True):
    mean = [sum(r["x"][i] for r in rows)/len(rows) for i in range(2)]
    std = [math.sqrt(sum((r["x"][i]-mean[i])**2 for r in rows)/len(rows)) or 1 for i in range(2)]
    return {"mean": mean if enabled else [0, 0], "std": std if enabled else [1, 1]}


def transform(rows, scaler):
    return [{**r, "x": [(r["x"][i]-scaler["mean"][i])/scaler["std"][i] for i in range(2)]} for r in rows]


def forward(theta, x):
    h = [math.tanh(theta[3*j]*x[0] + theta[3*j+1]*x[1] + theta[3*j+2]) for j in range(WIDTH)]
    z = sum((h[j]*theta[3*WIDTH+j] for j in range(WIDTH)), theta[-1])
    p = 1/(1+math.exp(-z)) if z >= 0 else math.exp(z)/(1+math.exp(z))
    return h, z, p


def weight_index(i):
    return (i < 3*WIDTH and i % 3 != 2) or 3*WIDTH <= i < 4*WIDTH


def evaluate(theta, rows, l2=0):
    gradient = [0.0]*len(theta)
    loss, correct, saturated, predictions = 0.0, 0, 0, []
    for row in rows:
        x, y = row["x"], row["y"]
        h, z, p = forward(theta, x)
        loss += max(z, 0)-z*y+math.log1p(math.exp(-abs(z)))
        correct += int(p >= 0.5) == y
        saturated += sum(abs(v) > 0.99 for v in h)
        predictions.append({"id": row["id"], "y": y, "p": p})
        d = p-y
        for j in range(WIDTH):
            dh = d*theta[3*WIDTH+j]*(1-h[j]**2)
            gradient[3*j] += dh*x[0]
            gradient[3*j+1] += dh*x[1]
            gradient[3*j+2] += dh
            gradient[3*WIDTH+j] += d*h[j]
        gradient[-1] += d
    loss /= len(rows)
    gradient = [g/len(rows) for g in gradient]
    penalty = l2/2*sum(v*v for i, v in enumerate(theta) if weight_index(i))
    gradient = [g+(l2*theta[i] if weight_index(i) else 0) for i, g in enumerate(gradient)]
    return {"loss": loss, "objective": loss+penalty, "penalty": penalty,
            "accuracy": correct/len(rows), "saturation": saturated/(len(rows)*WIDTH),
            "gradient": gradient, "predictions": predictions}


def optimizer_step(theta, gradient, state, config):
    step = state["step"] + 1
    if config["optimizer"] == "sgd":
        return [t-config["rate"]*g for t, g in zip(theta, gradient)], {"step": step, "m": state["m"][:], "v": state["v"][:]}
    m = [0.9*v+0.1*g for v, g in zip(state["m"], gradient)]
    v = [0.999*s+0.001*g*g for s, g in zip(state["v"], gradient)]
    update = [config["rate"]*(mi/(1-0.9**step))/(math.sqrt(vi/(1-0.999**step))+1e-8) for mi, vi in zip(m, v)]
    return [t-u for t, u in zip(theta, update)], {"step": step, "m": m, "v": v}


def order(length, epoch):
    indices = list(range(length))
    random = rng(1000+epoch)
    for i in range(length-1, 0, -1):
        j = int(random()*(i+1))
        indices[i], indices[j] = indices[j], indices[i]
    return indices


def run(preset="baseline", early_stop=False, batch_size=16, data=None, epochs=600):
    if preset not in PRESETS or type(early_stop) is not bool or batch_size not in (4, 16) or type(epochs) is not int or not 1 <= epochs <= 600:
        raise ValueError("Choose a known preset, a boolean stop policy, batch 4 or 16, and 1–600 epochs.")
    if data is None:
        data = json.loads(Path(__file__).with_name("data.json").read_text(encoding="utf-8"))
    validate(data)
    config = PRESETS[preset].copy()
    scaler = fit_scaler(data["train"], config["scale"])
    training, validation = transform(data["train"], scaler), transform(data["validation"], scaler)
    theta = initialize(config["init"])
    state = {"step": 0, "m": [0.0]*len(theta), "v": [0.0]*len(theta)}
    history, best, stale, patience_loss, stop_reason = [], None, 0, math.inf, "Epoch budget reached"
    for epoch in range(epochs+1):
        tr, va = evaluate(theta, training, config["l2"]), evaluate(theta, validation)
        record = {"epoch": epoch, "updates": state["step"], "train_loss": tr["loss"], "validation_loss": va["loss"], "objective": tr["objective"], "train_accuracy": tr["accuracy"], "validation_accuracy": va["accuracy"], "gradient_norm": math.sqrt(sum(g*g for g in tr["gradient"])), "saturation": tr["saturation"]}
        history.append(record)
        if best is None or va["loss"] < best["validation_loss"]:
            best = {**record, "theta": theta[:], "optimizer": {"step": state["step"], "m": state["m"][:], "v": state["v"][:]}}
        if va["loss"] < patience_loss - 0.0001:
            patience_loss = va["loss"]
            stale = 0
        else:
            stale += 1
        if early_stop and stale >= 30:
            stop_reason = "Validation patience reached (30 epochs)"
            break
        if epoch == epochs:
            break
        ids = order(len(training), epoch+1)
        for start in range(0, len(ids), batch_size):
            rows = [training[i] for i in ids[start:start+batch_size]]
            gradient = evaluate(theta, rows, config["l2"])["gradient"]
            theta, state = optimizer_step(theta, gradient, state, config)
            if not all(math.isfinite(v) for v in theta):
                raise ValueError("Non-finite parameters: inspect inputs, loss and learning rate.")
    last = {**history[-1], "theta": theta[:], "optimizer": state}
    return {"preset": preset, "config": config, "early_stop": early_stop, "batch_size": batch_size,
            "budget": epochs, "stop_reason": stop_reason, "scaler": scaler, "train_count": len(training),
            "validation_count": len(validation), "best": best, "last": last, "history": history,
            "best_predictions": evaluate(best["theta"], validation)["predictions"],
            "last_predictions": evaluate(theta, validation)["predictions"]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--preset", choices=PRESETS, default="baseline")
    parser.add_argument("--early-stop", action="store_true")
    parser.add_argument("--batch-size", type=int, choices=[4, 16], default=16)
    parser.add_argument("--epochs", type=int, default=600)
    parser.add_argument("--input", type=Path, default=Path(__file__).with_name("data.json"))
    args = parser.parse_args()
    try:
        data = json.loads(args.input.read_text(encoding="utf-8"))
        print(json.dumps(run(args.preset, args.early_stop, args.batch_size, data, args.epochs), indent=2, allow_nan=False))
    except (OSError, ValueError, TypeError, KeyError) as exc:
        parser.error(str(exc))


if __name__ == "__main__":
    main()
