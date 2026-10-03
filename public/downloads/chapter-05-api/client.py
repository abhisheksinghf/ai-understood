"""Call the local API, validate its result, then save one SQLite row."""
import argparse
import json
import math
from pathlib import Path
import sqlite3
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def validate_result(result):
    if not isinstance(result, dict):
        raise ValueError("Expected an object in the response.")
    value = result.get("prediction_seconds")
    if type(value) not in (int, float) or not 0 <= value <= 2_000_001:
        raise ValueError("Response prediction is outside the demo contract.")
    if not math.isfinite(value) or result.get("model_version") != "demo-v1":
        raise ValueError("Response does not match the expected model contract.")
    return result


def request_prediction(size, port=8765):
    body = json.dumps({"size_mb": size}, allow_nan=False).encode("utf-8")
    request = Request(f"http://127.0.0.1:{port}/predict", data=body,
                      headers={"Content-Type": "application/json"}, method="POST")
    with urlopen(request, timeout=5) as response:
        if response.status != 200 or response.headers.get_content_type() != "application/json":
            raise ValueError("Unexpected response status or content type.")
        return validate_result(json.loads(response.read().decode("utf-8")))


def save_prediction(database, size, result):
    connection = sqlite3.connect(database)
    try:
        with connection:
            connection.execute("""CREATE TABLE IF NOT EXISTS predictions (
                id INTEGER PRIMARY KEY, size_mb REAL NOT NULL,
                prediction_seconds REAL NOT NULL, model_version TEXT NOT NULL
            )""")
            cursor = connection.execute(
                "INSERT INTO predictions (size_mb, prediction_seconds, model_version) VALUES (?, ?, ?)",
                (size, result["prediction_seconds"], result["model_version"]),
            )
            return cursor.lastrowid
    finally:
        connection.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("size", type=float, nargs="?", default=3.0)
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    result = request_prediction(args.size, args.port)
    database = Path(__file__).with_name("predictions.db")
    row_id = save_prediction(database, args.size, result)
    print(f"Prediction: {result['prediction_seconds']:.1f} seconds ({result['model_version']})")
    print(f"Saved row {row_id} in predictions.db beside client.py")


if __name__ == "__main__":
    try:
        main()
    except HTTPError as error:
        raise SystemExit(f"HTTP {error.code}: {error.read().decode('utf-8', errors='replace')}") from None
    except (URLError, TimeoutError) as error:
        raise SystemExit(f"Connection failed or timed out. Is server.py running? {error}") from None
    except (ValueError, OSError, sqlite3.Error) as error:
        raise SystemExit(f"Could not finish: {error}") from None
