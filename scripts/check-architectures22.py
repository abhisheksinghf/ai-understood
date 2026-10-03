"""Run meaningful arithmetic tests, compare both implementations, and package the workbook."""
import importlib.util
import itertools
import json
import math
from pathlib import Path
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parent.parent
BOOK = ROOT / "public/downloads/chapter-22-architectures"
spec = importlib.util.spec_from_file_location("architecture22", BOOK/"explore.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
subprocess.run([sys.executable,"-m","unittest","-v","test_explore.py"],cwd=BOOK,check=True)
cases = [("cnn",list(c)) for c in itertools.product(module.DATA["posters"],module.DATA["kernels"],(1,2),(0,1))]
cases += [("sequence",list(c)) for c in itertools.product(module.DATA["histories"],(0,.5,1),(False,True))]
cases += [("transfer",[m]) for m in ("frozen","finetune")]
program = 'import * as m from "./src/lib/architectures.mjs"; console.log(JSON.stringify('+json.dumps(cases)+'.map(([fn,args])=>m[fn](...args))));'
reports = json.loads(subprocess.check_output(["node","--input-type=module","-e",program],cwd=ROOT,text=True))


def compare(a,b,at="root"):
    if isinstance(a,dict):
        assert a.keys() == b.keys(), at
        for k in a:
            compare(a[k],b[k],at+"."+k)
    elif isinstance(a,list):
        assert len(a) == len(b), at
        for i,(x,y) in enumerate(zip(a,b)):
            compare(x,y,at+f"[{i}]")
    elif isinstance(a,(int,float)) and not isinstance(a,bool):
        assert math.isclose(a,b,rel_tol=1e-10,abs_tol=1e-10), (at,a,b)
    else:
        assert a == b, (at,a,b)


for (fn,args),report in zip(cases,reports):
    compare(getattr(module,fn)(*args),report,fn+str(args))
for args in [["cnn","--stride","0"],["cnn","--poster","bad"],["sequence","--recurrent","2"],["transfer","--mode","bad"],[]]:
    r = subprocess.run([sys.executable,"explore.py",*args],cwd=BOOK,capture_output=True,text=True)
    assert r.returncode == 2 and "error:" in r.stderr,args
for args,expected in [(["cnn"],module.cnn()),(["sequence","--no-mask"],module.sequence(mask=False)),(["transfer","--mode","finetune"],module.transfer("finetune"))]:
    r = subprocess.run([sys.executable,"explore.py",*args],cwd=BOOK,capture_output=True,text=True,check=True)
    compare(json.loads(r.stdout),expected)
names = ["data.json","explore.py","test_explore.py","README.md"]
archive = ROOT/"public/downloads/chapter-22-architectures.zip"
with zipfile.ZipFile(archive,"w",zipfile.ZIP_DEFLATED) as z:
    for name in names:
        z.write(BOOK/name,name)
with zipfile.ZipFile(archive) as z:
    assert sorted(z.namelist()) == sorted(names)
    for name in names:
        assert z.read(name) == (BOOK/name).read_bytes()
print(json.dumps({"passed":True,"python_test_groups":8,"parity_cases":len(cases),"zip_files":names}))
