"""Validate the actual learner workbook and every executable chapter snippet."""
import contextlib
import importlib.util
import io
import json
import math
from pathlib import Path
import re
import subprocess
import sys
from zipfile import ZipFile, ZIP_DEFLATED

sys.dont_write_bytecode = True
root = Path(__file__).resolve().parent.parent
starter = root / "public/downloads/chapter-06-algebra"
spec = importlib.util.spec_from_file_location("algebra06", starter / "linear_algebra.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

assert module.dot([3, 2], [2, 0.5]) + 1 == 8
assert module.dot([4, 2], [2, 0.5]) + 1 == 10
assert module.dot([2, 4], [2, 0.5]) + 1 == 7
assert module.predict_batch([[1, 0], [2, 1], [3, 2]], [2, 0.5], 1) == [3, 5.5, 8]
assert module.predict_batch([[1, 0], [2, 1], [3, 2]], [2, 0.5], 0) == [2, 4.5, 7]
assert module.norm([3, 4]) == 5
assert module.norm([0.6, 0.8]) == 1
assert math.isclose(module.norm([2, 5]), math.sqrt(29))
assert module.cosine([3, 4], [6, 8]) == 1
assert module.cosine([3, 4], [-4, 3]) == 0
assert module.cosine([3, 4], [-3, -4]) == -1

matrices = [[[1, 0], [0, 1]], [[2, 0], [0, 1]], [[0, -1], [1, 0]],
            [[1, 1], [0, 1]], [[1, 0], [0, 0]]]
expected = [[2, 1], [4, 1], [-1, 2], [3, 1], [2, 0]]
for matrix, result in zip(matrices, expected):
    assert module.matvec(matrix, [2, 1]) == result
assert module.matvec(matrices[-1], [2, -3]) == [2, 0]
assert module.matvec([[1, 1], [2, -1]], [1, 2]) == [3, 0]
det = lambda a: a[0][0] * a[1][1] - a[0][1] * a[1][0]
assert [det(a) for a in matrices] == [1, 2, 1, 1, 0]
assert det([[1, 1], [2, -1]]) == -3
assert module.matvec(matrices[1], [1, 0]) == [2, 0]
assert module.matvec(matrices[1], [0, 1]) == [0, 1]

for operation in [lambda: module.dot([1, 2], [3]), lambda: module.dot([], []),
                  lambda: module.dot([True], [1]), lambda: module.norm([float("nan")]),
                  lambda: module.matvec([[1, 2], [3]], [1, 2]),
                  lambda: module.cosine([0, 0], [1, 0])]:
    try:
        operation()
    except ValueError:
        pass
    else:
        raise AssertionError("Expected explicit invalid-input failure")

before = sorted(p.name for p in starter.iterdir())
result = subprocess.run([sys.executable, str(starter / "linear_algebra.py")], cwd=root,
                        capture_output=True, text=True, check=True)
expected_output = "\n".join([
    "One prediction: 8.0 seconds", "Batch predictions: [3.0, 5.5, 8.0]",
    "Length of [3, 4]: 5.0", "Cosine of [3, 4] and [6, 8]: 1.0",
    "Rotated [2, 1]: [-1, 2]", "Projected [2, 1]: [2, 0]", "",
])
assert result.stdout == expected_output, result.stdout
assert sorted(p.name for p in starter.iterdir()) == before
content = (root / "src/content/chapter-06.mdx").read_text(encoding="utf-8")
stdout = io.StringIO()
with contextlib.redirect_stdout(stdout):
    for index, block in enumerate(re.findall(r"```python\n(.*?)\n```", content, re.S)):
        exec(compile(block, f"chapter06-block-{index}", "exec"), {})
assert stdout.getvalue().strip() == "[3.0, 5.5, 8.0]"

archive = root / "public/downloads/chapter-06-algebra-workbook.zip"
with ZipFile(archive, "w", ZIP_DEFLATED) as bundle:
    for name in ("linear_algebra.py", "README.md"):
        bundle.write(starter / name, arcname=name)
with ZipFile(archive) as bundle:
    assert bundle.testzip() is None and sorted(bundle.namelist()) == ["README.md", "linear_algebra.py"]
    for name in bundle.namelist():
        assert bundle.read(name) == (starter / name).read_bytes()

out = root / "tmp/qa/chapter-06"
out.mkdir(parents=True, exist_ok=True)
report = {"passed": True, "python": sys.version.split()[0], "checks": [
    "worked predictions and exercises", "norms, distance, cosine and zero-vector failure",
    "five transforms, determinants, eigenvector examples and equation solution",
    "invalid shapes and entries", "actual CLI output and no generated files",
    "all Python teaching snippets", "verified workbook ZIP",
]}
(out / "python-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps(report))
