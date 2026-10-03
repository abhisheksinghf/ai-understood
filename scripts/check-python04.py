"""Verify the learner's actual Python download and build its recorded trace."""
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import re
import contextlib
import io
from zipfile import ZipFile, ZIP_DEFLATED
sys.dont_write_bytecode = True

root = Path(__file__).resolve().parent.parent
starter = root / "public/downloads/chapter-04-python"
spec = importlib.util.spec_from_file_location("chapter04_example", starter / "evaluate_jobs.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
jobs = json.loads((starter / "jobs.json").read_text(encoding="utf-8"))
assert module.predict(2.5, 2.0) == 6.0
cases = [module.evaluate(jobs, weight) for weight in (1.0, 2.0)]
assert cases[0]["mse"] == 14 / 3
assert cases[1]["mse"] == 0
assert [row["running_total"] for row in cases[0]["rows"]] == [1.0, 5.0, 14.0]
assert module.evaluate([{"size": 3, "actual": 8}], 2)["mse"] == 1
changed = [*jobs[:2], {"size": 3.0, "actual": 8.0}]
assert module.evaluate(changed, 2)["mse"] == 1 / 3
for invalid in ([], {}, [None], [{"size": "2", "actual": 5}], [{"size": True, "actual": 5}],
                [{"size": -1, "actual": 3}], [{"size": 2, "actual": float("nan")}]):
    try:
        module.evaluate(invalid, 2)
    except ValueError:
        pass
    else:
        raise AssertionError(f"Invalid input was accepted: {invalid!r}")

# Exercise the downloadable CLI in isolation, including failures.
with tempfile.TemporaryDirectory(prefix="python04-", dir=root / "tmp") as directory:
    folder = Path(directory)
    for name in ("evaluate_jobs.py", "jobs.json"):
        shutil.copyfile(starter / name, folder / name)
    result = subprocess.run([sys.executable, str(folder / "evaluate_jobs.py")], cwd=root,
                            capture_output=True, text=True, check=True)
    expected = "w=1.0 | jobs=3 | MSE=4.6667 s^2\nw=2.0 | jobs=3 | MSE=0.0000 s^2\nSaved runtime_report.json\n"
    assert result.stdout == expected
    assert json.loads((folder / "runtime_report.json").read_text(encoding="utf-8")) == cases
    # Run every Python teaching block in order in an isolated folder. The
    # optional comprehension explicitly refers forward to Section 5's function.
    blocks = re.findall(r"```python\n(.*?)\n```", (root / "src/content/chapter-04.mdx").read_text(encoding="utf-8"), re.S)
    assert len(blocks) >= 10
    scope = {"__file__": str(folder / "scratch.py"), "predict": module.predict}
    sys.path.insert(0, str(folder))
    try:
        output_capture = io.StringIO()
        with contextlib.redirect_stdout(output_capture):
            for number, block in enumerate(blocks, 1):
                exec(compile(block, f"chapter04-example-{number}", "exec"), scope)
        assert "Predicted: 5.00 s" in output_capture.getvalue()
        assert "MSE: 4.6667 s^2" in output_capture.getvalue()
        assert "Check passed" in output_capture.getvalue()
        assert scope["squared_error"](4, 7) == 9
    finally:
        sys.path.pop(0)
    (folder / "jobs.json").write_text('[]', encoding="utf-8")
    failed = subprocess.run([sys.executable, str(folder / "evaluate_jobs.py")], capture_output=True, text=True)
    assert failed.returncode != 0 and "nonempty list" in failed.stderr
    (folder / "jobs.json").write_text('not JSON', encoding="utf-8")
    failed = subprocess.run([sys.executable, str(folder / "evaluate_jobs.py")], capture_output=True, text=True)
    assert failed.returncode != 0 and "Could not evaluate jobs:" in failed.stderr

trace_path = root / "src/data/pythonTrace.json"
trace = json.dumps(cases, indent=2) + "\n"
if "--write-trace" in sys.argv:
    trace_path.write_text(trace, encoding="utf-8")
else:
    assert json.loads(trace_path.read_text(encoding="utf-8")) == cases, "Recorded trace is stale"

archive = root / "public/downloads/chapter-04-python-starter.zip"
with ZipFile(archive, "w", ZIP_DEFLATED) as bundle:
    for name in ("evaluate_jobs.py", "jobs.json", "README.md"):
        bundle.write(starter / name, "chapter-04-python/" + name)
with ZipFile(archive) as bundle:
    assert bundle.testzip() is None
    assert len(bundle.namelist()) == 3
print(json.dumps({"passed": True, "python": sys.version.split()[0], "checks": [
    "worked calculations", "recorded loop trace", "changed-data exercise",
    "invalid input rejection", "CLI output", "JSON report", "script-relative paths",
    "malformed and empty input", "every Python teaching block", "ZIP contents"], "mse": [case["mse"] for case in cases]}))
