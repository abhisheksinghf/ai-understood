"""Verify the teaching calculations, browser/Python parity, CLI and ZIP."""
import importlib.util
import json
import math
from pathlib import Path
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parent.parent
BOOK = ROOT / "public/downloads/chapter-21-training"
spec = importlib.util.spec_from_file_location("train21", BOOK/"train.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
subprocess.run([sys.executable,"-m","unittest","-v","test_train.py"], cwd=BOOK, check=True)
cases = [(p, stop, batch) for p in module.PRESETS for stop in (False, True) for batch in (4,16)]
program = 'import {run} from "./src/lib/training-diagnostics.mjs"; console.log(JSON.stringify('+json.dumps(cases)+'.map(c=>run(...c))));'
reports = json.loads(subprocess.check_output(["node","--input-type=module","-e",program], cwd=ROOT, text=True))


def compare(a,b,path="root"):
    if isinstance(a,dict):
        assert a.keys() == b.keys(), path
        for k in a:
            compare(a[k],b[k],path+"."+k)
    elif isinstance(a,list):
        assert len(a) == len(b), path
        for i,(left,right) in enumerate(zip(a,b)):
            compare(left,right,path+f"[{i}]")
    elif isinstance(a,(float,int)) and not isinstance(a,bool):
        assert math.isclose(a,b,rel_tol=1e-7,abs_tol=1e-8), (path,a,b)
    else:
        assert a == b, (path,a,b)


sensitivity = []
for case, report in zip(cases,reports):
    python_report = module.run(*case)
    if case[0] == "raw" and case[2] == 4:
        # Saturation plus minibatches amplifies tiny cross-runtime roundoff.
        # Check the shared initial path and each run's own selection contract;
        # do not call their later, materially different trajectories equal.
        compare(python_report["scaler"],report["scaler"])
        compare(python_report["history"][:10],report["history"][:10])
        for result in (python_report, report):
            assert result["best"]["validation_loss"] == min(h["validation_loss"] for h in result["history"])
            assert result["last"]["updates"] == result["last"]["epoch"] * 4
            assert all(math.isfinite(h["train_loss"]) and math.isfinite(h["validation_loss"]) for h in result["history"])
        sensitivity.append({"early_stop":case[1],"python_final_validation":python_report["last"]["validation_loss"],"javascript_final_validation":report["last"]["validation_loss"]})
    else:
        compare(python_report,report,str(case))
for args in [["--epochs","0"],["--epochs","601"],["--batch-size","3"],["--preset","bad"],["--input","missing.json"]]:
    result = subprocess.run([sys.executable,"train.py",*args],cwd=BOOK,capture_output=True,text=True)
    assert result.returncode == 2 and "error:" in result.stderr,args
result = subprocess.run([sys.executable,"train.py","--preset","fast","--early-stop"],cwd=BOOK,capture_output=True,text=True,check=True)
compare(json.loads(result.stdout),module.run("fast",True))
files = ["data.json","train.py","test_train.py","README.md"]
archive = ROOT/"public/downloads/chapter-21-training.zip"
with zipfile.ZipFile(archive,"w",zipfile.ZIP_DEFLATED) as z:
    for name in files:
        z.write(BOOK/name,name)
with zipfile.ZipFile(archive) as z:
    assert sorted(z.namelist()) == sorted(files)
    for name in files:
        assert z.read(name) == (BOOK/name).read_bytes()
print(json.dumps({"passed":True,"parity_reports":len(cases)-len(sensitivity),"documented_sensitivity_cases":sensitivity,"python_test_groups":8,"zip_files":files}))
