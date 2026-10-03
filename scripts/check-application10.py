"""Verify workbook, record deterministic Python traces, and package downloads."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
from zipfile import ZipFile, ZIP_DEFLATED

sys.dont_write_bytecode = True
root = Path(__file__).resolve().parent.parent
starter = root / "public/downloads/chapter-10-llm-app"
out = root / "tmp/qa/chapter-10"
out.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(starter))
import app

env = dict(os.environ, PYTHONDONTWRITEBYTECODE="1")
check = subprocess.run([sys.executable, "-m", "unittest", "-v", "test_app.py"], cwd=starter, env=env, capture_output=True, text=True)
assert check.returncode == 0, check.stdout + check.stderr
print(check.stderr)
data = app.load_json((starter / "fixtures.json").read_text(encoding="utf-8"))
traces = {"notice": data["notice"], "sources": data["sources"], "cases": []}
for case in data["cases"]:
    runs = {}
    for budget in (1, 2):
        result = app.run_recommender(case.get("sources", data["sources"]), app.FixtureProvider(case["outcomes"]), budget, lambda _: None)
        run = subprocess.run([sys.executable, "app.py", "--case", case["id"], "--attempts", str(budget)], cwd=starter, env=env, capture_output=True, text=True)
        assert run.returncode == (0 if result["status"] == "review_required" else 1), run.stderr
        cli = json.loads(run.stdout)
        assert cli.pop("mode") == "offline fixture; no LLM; waits skipped"
        assert cli == result
        runs[str(budget)] = result
    traces["cases"].append({key:case[key] for key in ("id", "label", "lesson")} | {"runs":runs})
trace_file = root / "src/data/applicationTrace.json"
if "--write-trace" in sys.argv:
    trace_file.write_text(json.dumps(traces, indent=2) + "\n", encoding="utf-8")
assert json.loads(trace_file.read_text(encoding="utf-8")) == traces, "Regenerate trace intentionally using --write-trace"
for args in (("--input", "missing.json"), ("--attempts", "3"), ("--live",)):
    safe_env = {k:v for k,v in env.items() if k not in ("OPENAI_API_KEY", "OPENAI_MODEL")}
    run = subprocess.run([sys.executable, "app.py", *args], cwd=starter, env=safe_env, capture_output=True, text=True)
    assert run.returncode == 2, run.stdout + run.stderr
names = ("app.py", "provider.py", "errors.py", "fixtures.json", "sources.json", "test_app.py", "README.md")
archive = root / "public/downloads/chapter-10-llm-app-workbook.zip"
with ZipFile(archive, "w", ZIP_DEFLATED) as bundle:
    for name in names:
        bundle.write(starter/name, arcname=name)
with ZipFile(archive) as bundle:
    assert sorted(bundle.namelist()) == sorted(names)
    for name in names:
        assert bundle.read(name) == (starter/name).read_bytes()
report = {"passed":True, "fixtureRuns":20, "unitTests":13, "liveCalls":0, "archiveFiles":len(names), "checks":["workflow outcomes", "retry budgets", "invalid-input zero calls", "response envelope handling", "strict JSON and contract", "unsupported claim limitation", "fake HTTP adapter", "CLI parity", "trace parity", "ZIP contents"]}
(out / "python-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps(report))
