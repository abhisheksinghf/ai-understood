"""Call the local API, validate its result, then save one SQLite row."""
import argparse
import json
import re
from pathlib import Path
import sqlite3
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def validate_result(result, expected_note_id=None):
    if not isinstance(result, dict):
        raise ValueError("Expected an object in the response.")
    note_id = result.get("note_id")
    if not isinstance(note_id, str) or re.fullmatch(r"N[0-9]{2}", note_id) is None:
        raise ValueError("Response needs a valid note_id.")
    if expected_note_id is not None and note_id != expected_note_id:
        raise ValueError("Response does not match the requested note.")
    if any(not isinstance(result.get(field), str) or not result[field].strip()
           for field in ("title", "text")):
        raise ValueError("Response needs a nonempty title and text.")
    minutes = result.get("estimated_minutes")
    if type(minutes) is not int or not 0 <= minutes <= 1440:
        raise ValueError("estimated_minutes must be an integer from 0 to 1440.")
    if result.get("source_version") != "notes-v1":
        raise ValueError("Unexpected source version.")
    return result


def request_note(note_id, port=8765):
    body = json.dumps({"note_id": note_id}, allow_nan=False).encode("utf-8")
    request = Request(f"http://127.0.0.1:{port}/notes/lookup", data=body,
                      headers={"Content-Type": "application/json"}, method="POST")
    with urlopen(request, timeout=5) as response:
        if response.status != 200 or response.headers.get_content_type() != "application/json":
            raise ValueError("Unexpected response status or content type.")
        return validate_result(json.loads(response.read().decode("utf-8")), note_id)


def save_note(database, result):
    validate_result(result)
    connection = sqlite3.connect(database)
    try:
        with connection:
            connection.execute("""CREATE TABLE IF NOT EXISTS note_history (
                id INTEGER PRIMARY KEY, note_id TEXT NOT NULL, title TEXT NOT NULL,
                text TEXT NOT NULL, estimated_minutes INTEGER NOT NULL,
                source_version TEXT NOT NULL
            )""")
            cursor = connection.execute(
                "INSERT INTO note_history (note_id, title, text, estimated_minutes, source_version) "
                "VALUES (?, ?, ?, ?, ?)",
                tuple(result[field] for field in
                      ("note_id", "title", "text", "estimated_minutes", "source_version")),
            )
            return cursor.lastrowid
    finally:
        connection.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("note_id", nargs="?", default="N01")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    result = request_note(args.note_id, args.port)
    database = Path(__file__).with_name("study_history.db")
    row_id = save_note(database, result)
    print(f"Note: {result['note_id']} | {result['title']} | {result['estimated_minutes']} minutes ({result['source_version']})")
    print(f"Saved row {row_id} in study_history.db beside client.py")


if __name__ == "__main__":
    try:
        main()
    except HTTPError as error:
        raise SystemExit(f"HTTP {error.code}: {error.read().decode('utf-8', errors='replace')}") from None
    except (URLError, TimeoutError) as error:
        raise SystemExit(f"Connection failed or timed out. Is server.py running? {error}") from None
    except (ValueError, OSError, sqlite3.Error) as error:
        raise SystemExit(f"Could not finish: {error}") from None
