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
    for size, expected in [(0, 1), (3, 7), (4, 9), (1_000_000, 2_000_001)]:
        status, result = call("/predict", json.dumps({"size_mb": size}).encode())
        assert status == 200 and result == {"prediction_seconds": expected, "model_version": "demo-v1"}
    for body in [b'{', b'[]', b'null', b'{}', b'{"size_gb": 3}', b'{"size_mb": "3"}',
                 b'{"size_mb": true}', b'{"size_mb": null}', b'{"size_mb": -1}',
                 b'{"size_mb": 1000001}', b'{"size_mb": NaN}', b'{"size_mb": Infinity}',
                 b'{"size_mb": 1e400}', b'{"size_mb": 3, "other": NaN}', b'\xff']:
        assert call("/predict", body)[0] == 400, body
    assert call("/predict", b'{"size_mb": 3}', "text/plain")[0] == 415
    assert call("/predict", b" " * 65537)[0] == 413
    checks.append("real HTTP success, boundaries, malformed JSON, wrong fields/types, status and media type")

    for bad in [None, [], {}, {"seconds": 7}, {"prediction_seconds": True, "model_version": "demo-v1"},
                {"prediction_seconds": float("nan"), "model_version": "demo-v1"},
                {"prediction_seconds": 7, "model_version": "other"}]:
        try:
            client_module.validate_result(bad)
        except ValueError:
            pass
        else:
            raise AssertionError(f"Bad response accepted: {bad}")
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
        assert not (folder / "predictions.db").exists()
        for size, expected, row in [(3, "7.0", 1), (4, "9.0", 2), (1, "3.0", 3)]:
            result = run("client.py", str(size), "--port", str(port))
            assert result.returncode == 0, result.stderr
            assert f"Prediction: {expected} seconds (demo-v1)" in result.stdout
            assert f"Saved row {row}" in result.stdout
        rejected = run("client.py", "-1", "--port", str(port))
        assert rejected.returncode != 0 and "HTTP 400" in rejected.stderr
        nonfinite = run("client.py", "nan", "--port", str(port))
        assert nonfinite.returncode != 0
        database = folder / "predictions.db"
        before = database.read_bytes()
        inspection = run("inspect_data.py")
        assert inspection.returncode == 0, inspection.stderr
        assert "1 | 3.0 | 7.0" in inspection.stdout and "2 | 4.0 | 9.0" in inspection.stdout
        assert "2 matching row(s)" in inspection.stdout
        assert database.read_bytes() == before
        connection = sqlite3.connect(database)
        assert connection.execute("SELECT COUNT(*) FROM predictions").fetchone()[0] == 3
        connection.close()
        checks.append("downloadable CLI, append-only successful history, no writes on failures, read-only inspection")

    # Run every Python and SQL teaching block with its documented prerequisites.
    content = (root / "src/content/chapter-05.mdx").read_text(encoding="utf-8")
    connection = sqlite3.connect(":memory:")
    connection.execute("CREATE TABLE predictions (id INTEGER, size_mb REAL, prediction_seconds REAL, model_version TEXT)")
    connection.executemany("INSERT INTO predictions VALUES (?, ?, ?, ?)",
                           [(1, 1, 3, "demo-v1"), (2, 2, 5, "demo-v1"), (3, 3, 7, "demo-v1")])
    for sql in re.findall(r"```sql\n(.*?)\n```", content, re.S):
        assert connection.execute(sql).fetchall() == [(2, 2.0, 5.0), (3, 3.0, 7.0)]
    namespace = {"connection": connection}
    stdout = io.StringIO()
    with contextlib.redirect_stdout(stdout):
        for index, block in enumerate(re.findall(r"```python\n(.*?)\n```", content, re.S)):
            # Substitute only the available loopback port for the running test server.
            code = block.replace("127.0.0.1:8765", f"127.0.0.1:{port}")
            exec(compile(code, f"chapter05-block-{index}", "exec"), namespace)
    assert namespace["rows"] == [(2,), (3,)]
    assert stdout.getvalue().strip() == "7.0"
    connection.close()
    checks.append("all Python and SQL chapter examples")
finally:
    server.shutdown()
    server.server_close()
    thread.join(timeout=3)

try:
    client_module.request_prediction(3, port)
except (OSError, TimeoutError):
    checks.append("stopped server gives a connection failure")
else:
    raise AssertionError("Stopped server unexpectedly answered")

archive = root / "public/downloads/chapter-05-api-starter.zip"
names = ["server.py", "client.py", "inspect_data.py", "README.md"]
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
