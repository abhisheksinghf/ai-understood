# Chapter 5: a local prediction API

Requires Python 3.10 or newer with its standard sqlite3 module. No pip packages,
accounts, API keys, or internet services. All inputs are synthetic.

Extract the ZIP. Open two terminals in the extracted folder.

Terminal A:
```powershell
py server.py
```
Leave it running. Terminal B:
```powershell
py client.py 3
py inspect_data.py
```
If your Python command is python or python3, substitute it for py.

The first command prints:
```
Prediction: 7.0 seconds (demo-v1)
Saved row 1 in predictions.db beside client.py
```
The row ID is 1 in a new database; later successful runs append rows.
The query prints that row because 7 >= 5. Running the inspection again adds nothing.
The server keeps no prediction history. The CLIENT writes predictions.db beside
client.py only after a successful, validated response. Invalid requests add no row.

## Try changes

- `py client.py 4` prints 9.0 seconds and appends one row.
- `py client.py -1` reports HTTP 400 and appends nothing.
- Stop Terminal A with Ctrl+C. Call the client again to see a connection failure.
- A fresh folder extracted from the ZIP starts with no database.

If port 8765 is occupied, use `py server.py --port 8766` and
`py client.py 3 --port 8766` instead. Stop your server with Ctrl+C when finished.

## Contract

- GET http://127.0.0.1:8765/health -> 200, {"status": "ok"}.
- POST /predict requires Content-Type: application/json and a JSON object with
  numeric size_mb from 0 to 1000000 (inclusive); booleans and strings are rejected.
- Example body: {"size_mb": 3}. Example 200 response:
  {"prediction_seconds": 7.0, "model_version": "demo-v1"}.
- Bad input: 400. Unknown path: 404. Wrong content type: 415. Body over 64 KiB: 413.
- The client waits up to 5 seconds on blocking network operations and does not retry.
  This setting is not a strict deadline for the entire program.

The formula 2 * size_mb + 1 is fixed, not trained or validated on real jobs.
The accepted range is an input rule, not an accuracy guarantee. No authentication,
rate limiting, deployment setup, or production hardening is included. Python's
http.server is used only to expose the request/response mechanics on this computer.
The handbook's failure explorer is an independent, simulated teaching tool; it
does not call this server.
