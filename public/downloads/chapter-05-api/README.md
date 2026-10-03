# Chapter 5: a local study-note API

Requires Python 3.10 or newer with its standard sqlite3 module. No pip packages,
accounts, API keys, or internet services. The three study notes are authored
teaching examples. Study-time estimates are illustrative, not mastery guarantees.

Extract the ZIP. Open two terminals in the extracted folder.

Terminal A:
```powershell
py server.py
```
Leave it running. Terminal B:
```powershell
py client.py N01
py inspect_data.py
```
If your Python command is python or python3, substitute it for py.

The first command prints:
```
Note: N01 | Overfitting | 20 minutes (notes-v1)
Saved row 1 in study_history.db beside client.py
```
The row ID is 1 in a new database; later successful runs append rows.
Inspection selects estimates of at least 15 minutes, so it displays this row.
Running inspection again adds nothing. The server keeps no lookup history.
The CLIENT writes study_history.db beside client.py only after a successful,
validated response. Invalid requests add no row. A retrieved note is not evidence
that someone studied it, mastered it, or trained a model.

## Try changes

- `py client.py N02` returns Gradient descent, estimated at 15 minutes, and appends a row.
- `py client.py N03` saves Features and labels, estimated at 10 minutes. Inspection's
  15-minute filter excludes that row; the record is still in the database.
- `py client.py invalid` reports HTTP 400 and appends nothing.
- `py client.py N99` reports HTTP 404: valid ID format, but no matching note.
- Stop Terminal A with Ctrl+C. Call the client again to see a connection failure.
- A fresh folder extracted from the ZIP starts with no database.

If port 8765 is occupied, use `py server.py --port 8766` and
`py client.py N01 --port 8766` instead. Stop your server with Ctrl+C when finished.

## Contract and source

- GET http://127.0.0.1:8765/health -> 200, {"status": "ok"}.
- POST /notes/lookup requires Content-Type: application/json and a JSON object with
  a string note_id matching N followed by two digits, for example {"note_id": "N01"}.
- A 200 response contains note_id, title, text, estimated_minutes, and source_version.
  N01 is Overfitting, estimated_minutes is 20, and source_version is notes-v1.
- The client requires the requested ID, nonempty title and text, an integer estimate
  from 0 to 1440 (not a boolean), and source_version notes-v1. These checks establish
  structure, not factual truth or a learner's understanding.
- Bad input: 400. Unknown note/path: 404. Wrong content type: 415. Body over 64 KiB: 413.
- The client waits up to 5 seconds on blocking network operations and does not retry.
  This setting is not a strict deadline for the entire program.
- notes.json is loaded at server startup. Restart after editing it. If you version
  the collection, update the server's version and the client's accepted contract together.

POST processes the lookup without modifying server data. Repeated successful client
runs append separate history rows. This is exact-ID lookup, not semantic search,
RAG, or model inference. Later chapters add those capabilities. No authentication,
rate limiting, or production hardening is included. Python's http.server exposes
request/response mechanics only on this computer's loopback address.
The handbook's failure explorer is an independent local simulation; it does not
call this server. Keep generated databases out of version control.
