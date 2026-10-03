"""Verify Python, JS parity, CLI contracts, and the three-file workbook ZIP."""
import importlib.util
import json
import math
from pathlib import Path
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parent.parent
BOOK = ROOT / "public/downloads/chapter-20-neural-networks"
spec = importlib.util.spec_from_file_location("network20", BOOK / "network.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
subprocess.run([sys.executable, "-m", "unittest", "-v", "test_network.py"], cwd=BOOK, check=True)
cases = [(a, n, rate) for a in ("hidden", "linear") for n in (0, 1, 100, 2000) for rate in (0.1, 0.5, 2)]
program = 'import {train} from "./src/lib/neural-network.mjs"; const cases='+json.dumps(cases)+'; console.log(JSON.stringify(cases.map(c=>train(...c))));'
javascript = json.loads(subprocess.check_output(["node", "--input-type=module", "-e", program], cwd=ROOT, text=True))


def compare(a, b, path="root"):
    if isinstance(a, dict):
        assert a.keys() == b.keys(), path
        for key in a:
            compare(a[key], b[key], path+"."+key)
    elif isinstance(a, list):
        assert len(a) == len(b), path
        for i, (left, right) in enumerate(zip(a, b)):
            compare(left, right, path+f"[{i}]")
    elif isinstance(a, (float, int)):
        assert math.isclose(a, b, rel_tol=1e-9, abs_tol=1e-10), (path, a, b)
    else:
        assert a == b, (path, a, b)


for case, report in zip(cases, javascript):
    compare(module.train(*case), report, str(case))
for args in [["--steps", "-1"], ["--steps", "2001"], ["--steps", "1.5"], ["--rate", "nan"], ["--rate", "0"], ["--architecture", "bad"]]:
    result = subprocess.run([sys.executable, "network.py", *args], cwd=BOOK, capture_output=True, text=True)
    assert result.returncode == 2 and "error:" in result.stderr, args
result = subprocess.run([sys.executable, "network.py", "--steps", "1"], cwd=BOOK, capture_output=True, text=True, check=True)
compare(json.loads(result.stdout), module.train("hidden", 1))
files = ["network.py", "test_network.py", "README.md"]
archive = ROOT / "public/downloads/chapter-20-neural-networks.zip"
with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as z:
    for name in files:
        z.write(BOOK/name, name)
with zipfile.ZipFile(archive) as z:
    assert sorted(z.namelist()) == sorted(files)
    for name in files:
        assert z.read(name) == (BOOK/name).read_bytes()
print(json.dumps({"passed": True, "parity_reports": len(cases), "python_test_groups": 6, "zip_files": files}))
