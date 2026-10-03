"""Read the history created by client.py, without modifying it."""
from pathlib import Path
import sqlite3


def main():
    database = Path(__file__).with_name("study_history.db")
    if not database.exists():
        raise SystemExit("Run client.py successfully first to create study_history.db.")
    connection = sqlite3.connect(database.as_uri() + "?mode=ro", uri=True)
    try:
        rows = connection.execute(
            "SELECT id, note_id, estimated_minutes FROM note_history "
            "WHERE estimated_minutes >= ? ORDER BY id", (15,)
        ).fetchall()
        print("id | note_id | estimated_minutes (at least 15)")
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
