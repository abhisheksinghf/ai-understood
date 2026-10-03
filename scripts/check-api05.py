"""Exercise the actual downloadable API and package only the source files."""
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import re
import shutil
import sqlite3
import subprocess
import sys
import tempfile
from threading import Thread
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from zipfile import ZipFile, ZIP_DEFLATED

sys.dont_write_bytecode = True
root = Path(__file__).resolve().parent.parent
starter = root / "public/downloads/chapter-05-api"


def load(name):
    spec = importlib.util.spec_from_file_location("api05_" + name, starter / (name + ".py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


server_module, client_module = load("server"), load("client")
server = server_module.create_server(0)
thread = Thread(target=server.serve_forever, daemon=True)
thread.start()
port = server.server_port
base = f"http://127.0.0.1:{port}"


def call(path, body=None, content_type="application/json"):
    request = Request(base + path, data=body, headers={"Content-Type": content_type})
    try:
        response = urlopen(request, timeout=3)
    except HTTPError as error:
        response = error
    with response:
        assert response.headers.get_content_type() == "application/json"
        return response.status, json.loads(response.read())


checks = []
try:
    assert call("/health") == (200, {"status": "ok"})
    assert call("/missing")[0] == 404
    assert call("/missing", b"{}")[0] == 404
    for note_id, expected in server_module.NOTES.items():
        status, result = call("/notes/lookup", json.dumps({"note_id": note_id}).encode())
        assert status == 200 and result == {"note_id": note_id, **expected, "source_version": "notes-v1"}
    for body in [b'{', b'[]', b'null', b'{}', b'{"id": "N01"}', b'{"note_id": 3}',
                 b'{"note_id": true}', b'{"note_id": null}', b'{"note_id": "invalid"}',
                 b'{"note_id": "N001"}', b'{"note_id": "N01", "other": NaN}', b'\xff']:
        assert call("/notes/lookup", body)[0] == 400, body
    assert call("/notes/lookup", b'{"note_id": "N99"}')[0] == 404
    assert call("/notes/lookup", b'{"note_id": "N01"}', "text/plain")[0] == 415
    assert call("/notes/lookup", b" " * 65537)[0] == 413
    checks.append("real HTTP success, boundaries, malformed JSON, wrong fields/types, status and media type")

    valid = {"note_id": "N01", **server_module.NOTES["N01"], "source_version": "notes-v1"}
    bad_results = [None, [], {}, {**valid, "note_id": "N02"}]
    for field, values in {
        "title": [None, "", "   ", 2], "text": [None, "", 3],
        "estimated_minutes": [True, -1, 1441, 20.5, float("nan")],
        "source_version": [None, "other"], "note_id": [None, 1, "invalid"],
    }.items():
        bad_results.extend({**valid, field: value} for value in values)
    for bad in bad_results:
        try:
            client_module.validate_result(bad, "N01")
        except ValueError:
            pass
        else:
            raise AssertionError(f"Bad response accepted: {bad}")
    for minutes in [0, 1440]:
        assert client_module.validate_result({**valid, "estimated_minutes": minutes})["estimated_minutes"] == minutes
    checks.append("client rejects unexpected response contracts")

    with tempfile.TemporaryDirectory(prefix="api05-", dir=root / "tmp") as directory:
        folder = Path(directory)
        for name in ("client.py", "inspect_data.py"):
            shutil.copyfile(starter / name, folder / name)
        def run(name, *args):
            return subprocess.run([sys.executable, str(folder / name), *args], cwd=root,
                                  capture_output=True, text=True, timeout=10,
                                  env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"})
        missing = run("inspect_data.py")
        assert missing.returncode != 0 and "Run client.py" in missing.stderr
        assert not (folder / "study_history.db").exists()
        for note_id, title, minutes, row in [("N01", "Overfitting", 20, 1),
                                              ("N02", "Gradient descent", 15, 2),
                                              ("N03", "Features and labels", 10, 3)]:
            result = run("client.py", note_id, "--port", str(port))
            assert result.returncode == 0, result.stderr
            assert f"Note: {note_id} | {title} | {minutes} minutes (notes-v1)" in result.stdout
            assert f"Saved row {row}" in result.stdout
        rejected = run("client.py", "invalid", "--port", str(port))
        assert rejected.returncode != 0 and "HTTP 400" in rejected.stderr
        unknown = run("client.py", "N99", "--port", str(port))
        assert unknown.returncode != 0 and "HTTP 404" in unknown.stderr
        database = folder / "study_history.db"
        before = database.read_bytes()
        inspection = run("inspect_data.py")
        assert inspection.returncode == 0, inspection.stderr
        assert "1 | N01 | 20" in inspection.stdout and "2 | N02 | 15" in inspection.stdout
        assert "2 matching row(s)" in inspection.stdout
        assert database.read_bytes() == before
        connection = sqlite3.connect(database)
        assert connection.execute("SELECT COUNT(*) FROM note_history").fetchone()[0] == 3
        connection.close()
        # A repeated success is a separate history event, not an upsert.
        repeated = run("client.py", "N01", "--port", str(port))
        assert repeated.returncode == 0 and "Saved row 4" in repeated.stdout
        with contextlib.closing(sqlite3.connect(database)) as db:
            assert db.execute("SELECT COUNT(*) FROM note_history WHERE note_id = ?", ("N01",)).fetchone()[0] == 2
        bad_db = folder / "rejected.db"
        try:
            client_module.save_note(bad_db, {**valid, "text": ""})
        except ValueError:
            pass
        else:
            raise AssertionError("Invalid result was persisted")
        assert not bad_db.exists()
        checks.append("downloadable CLI, append-only successful history, no writes on failures, read-only inspection")

    # Run every Python and SQL teaching block with its documented prerequisites.
    content = (root / "src/content/chapter-05.mdx").read_text(encoding="utf-8")
    connection = sqlite3.connect(":memory:")
    connection.execute("CREATE TABLE note_history (id INTEGER, note_id TEXT, estimated_minutes INTEGER, source_version TEXT)")
    connection.executemany("INSERT INTO note_history VALUES (?, ?, ?, ?)",
                           [(1, "N03", 10, "notes-v1"), (2, "N02", 15, "notes-v1"), (3, "N01", 20, "notes-v1")])
    for sql in re.findall(r"```sql\n(.*?)\n```", content, re.S):
        assert connection.execute(sql).fetchall() == [(2, "N02", 15), (3, "N01", 20)]
    namespace = {"connection": connection}
    stdout = io.StringIO()
    with contextlib.redirect_stdout(stdout):
        for index, block in enumerate(re.findall(r"```python\n(.*?)\n```", content, re.S)):
            # Substitute only the available loopback port for the running test server.
            code = block.replace("127.0.0.1:8765", f"127.0.0.1:{port}")
            exec(compile(code, f"chapter05-block-{index}", "exec"), namespace)
    assert namespace["rows"] == [(2,), (3,)]
    assert stdout.getvalue().strip() == "Overfitting"
    connection.close()
    checks.append("all Python and SQL chapter examples")
finally:
    server.shutdown()
    server.server_close()
    thread.join(timeout=3)

try:
    client_module.request_note("N01", port)
except (OSError, TimeoutError):
    checks.append("stopped server gives a connection failure")
else:
    raise AssertionError("Stopped server unexpectedly answered")

archive = root / "public/downloads/chapter-05-api-starter.zip"
names = ["server.py", "client.py", "inspect_data.py", "notes.json", "README.md"]
with ZipFile(archive, "w", ZIP_DEFLATED) as bundle:
    for name in names:
        bundle.write(starter / name, arcname=name)
with ZipFile(archive) as bundle:
    assert bundle.testzip() is None and sorted(bundle.namelist()) == sorted(names)
    for name in names:
        assert bundle.read(name) == (starter / name).read_bytes()
checks.append("starter ZIP contains only the verified source files")
out = root / "tmp/qa/chapter-05"
out.mkdir(parents=True, exist_ok=True)
report = {"passed": True, "python": sys.version.split()[0], "checks": checks}
(out / "python-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps(report))
