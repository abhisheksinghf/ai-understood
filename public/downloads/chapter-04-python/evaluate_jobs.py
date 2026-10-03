"""Chapter 4: evaluate fixed weights on synthetic job runtimes.

Run with Python 3. Only the standard library is used.
This evaluates predictions; it does not train a model.
"""
import json
import math
from pathlib import Path


def predict(size, weight):
    """Return the predicted runtime in seconds."""
    return weight * size + 1.0


def evaluate(jobs, weight):
    """Return per-row errors and mean squared error for a nonempty dataset."""
    if not isinstance(jobs, list) or not jobs:
        raise ValueError("jobs must be a nonempty list")
    if type(weight) not in (int, float) or not math.isfinite(weight):
        raise ValueError("weight must be a finite number")

    rows = []
    total = 0.0
    for index, job in enumerate(jobs):
        if not isinstance(job, dict):
            raise ValueError(f"row {index + 1} must be an object")
        size = job["size"]
        actual = job["actual"]
        for name, value in (("size", size), ("actual", actual)):
            if type(value) not in (int, float) or not math.isfinite(value):
                raise ValueError(f"row {index + 1}: {name} must be a finite number")
            if value < 0:
                raise ValueError(f"row {index + 1}: {name} cannot be negative")

        prediction = predict(size, weight)
        error = prediction - actual
        squared_error = error ** 2
        total += squared_error
        rows.append({
            "size": size,
            "actual": actual,
            "prediction": prediction,
            "error": error,
            "squared_error": squared_error,
            "running_total": total,
        })

    return {"weight": weight, "count": len(rows), "mse": total / len(rows), "rows": rows}


def main():
    folder = Path(__file__).resolve().parent
    jobs = json.loads((folder / "jobs.json").read_text(encoding="utf-8"))
    reports = [evaluate(jobs, weight) for weight in (1.0, 2.0)]
    for report in reports:
        print(f"w={report['weight']:.1f} | jobs={report['count']} | MSE={report['mse']:.4f} s^2")
    output = folder / "runtime_report.json"
    output.write_text(json.dumps(reports, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print("Saved runtime_report.json")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError) as error:
        raise SystemExit(f"Could not evaluate jobs: {error}")
