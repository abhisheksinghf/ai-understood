"""Read the history created by client.py, without modifying it."""
from pathlib import Path
import sqlite3


def main():
    database = Path(__file__).with_name("predictions.db")
    if not database.exists():
        raise SystemExit("Run client.py successfully first to create predictions.db.")
    connection = sqlite3.connect(database.as_uri() + "?mode=ro", uri=True)
    try:
        rows = connection.execute(
            "SELECT id, size_mb, prediction_seconds FROM predictions "
            "WHERE prediction_seconds >= ? ORDER BY id", (5.0,)
        ).fetchall()
        print("id | size_mb | prediction_seconds (at least 5)")
        for row in rows:
            print(" | ".join(str(value) for value in row))
        print(f"{len(rows)} matching row(s)")
    finally:
        connection.close()


if __name__ == "__main__":
    try:
        main()
    except (OSError, sqlite3.Error) as error:
        raise SystemExit(f"Could not read history: {error}") from None
