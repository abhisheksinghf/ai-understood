"""Chapter 4: evaluate fixed weights on synthetic house prices.

Run with Python 3. Only the standard library is used.
This evaluates predictions; it does not train a model.
"""
import json
import math
from pathlib import Path


def predict(area, weight):
    """Return the predicted price in units of 10 lakh rupees."""
    return weight * area + 1.0


def evaluate(houses, weight):
    """Return per-row errors and mean squared error for a nonempty dataset."""
    if not isinstance(houses, list) or not houses:
        raise ValueError("houses must be a nonempty list")
    if type(weight) not in (int, float) or not math.isfinite(weight):
        raise ValueError("weight must be a finite number")

    rows = []
    total = 0.0
    for index, house in enumerate(houses):
        if not isinstance(house, dict):
            raise ValueError(f"row {index + 1} must be an object")
        area = house["area"]
        actual = house["actual"]
        for name, value in (("area", area), ("actual", actual)):
            if type(value) not in (int, float) or not math.isfinite(value):
                raise ValueError(f"row {index + 1}: {name} must be a finite number")
            if value < 0:
                raise ValueError(f"row {index + 1}: {name} cannot be negative")

        prediction = predict(area, weight)
        error = prediction - actual
        squared_error = error ** 2
        total += squared_error
        rows.append({
            "area": area,
            "actual": actual,
            "prediction": prediction,
            "error": error,
            "squared_error": squared_error,
            "running_total": total,
        })

    return {"weight": weight, "count": len(rows), "mse": total / len(rows), "rows": rows}


def main():
    folder = Path(__file__).resolve().parent
    houses = json.loads((folder / "houses.json").read_text(encoding="utf-8"))
    reports = [evaluate(houses, weight) for weight in (1.0, 2.0)]
    for report in reports:
        print(f"w={report['weight']:.1f} | houses={report['count']} | MSE={report['mse']:.4f} price_units^2")
    output = folder / "price_report.json"
    output.write_text(json.dumps(reports, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print("Saved price_report.json")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError) as error:
        raise SystemExit(f"Could not evaluate houses: {error}")
