"""Run workbook invariants, compare the eight complete reports, check and package CLI."""
import importlib.util
import itertools
import json
import math
from pathlib import Path
import subprocess
import sys
import zipfile

ROOT=Path(__file__).resolve().parent.parent
BOOK=ROOT/"public/downloads/chapter-24-attention"
spec=importlib.util.spec_from_file_location("attention24",BOOK/"attention.py")
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
subprocess.run([sys.executable,"-m","unittest","-v","test_attention.py"],cwd=BOOK,check=True)
cases=list(itertools.product(("fun","slow"),("none","sinusoidal"),(True,False)))
program='import {explore} from "./src/lib/attention.mjs"; console.log(JSON.stringify('+json.dumps(cases)+'.map(a=>explore(...a))));'
reports=json.loads(subprocess.check_output(["node","--input-type=module","-e",program],cwd=ROOT,encoding="utf-8"))


def compare(a,b):
    if isinstance(a,dict):
        assert a.keys()==b.keys()
        for key in a: compare(a[key],b[key])
    elif isinstance(a,list):
        assert len(a)==len(b)
        for x,y in zip(a,b): compare(x,y)
    elif isinstance(a,(int,float)) and not isinstance(a,bool):
        assert math.isclose(a,b,abs_tol=1e-10,rel_tol=1e-10),(a,b)
    else: assert a==b,(a,b)


for args,report in zip(cases,reports): compare(module.explore(*args),report)
for args in [["--ending","bad"],["--positions","bad"],["--mask","false"]]:
    r=subprocess.run([sys.executable,"attention.py",*args],cwd=BOOK,capture_output=True,text=True)
    assert r.returncode==2 and "error:" in r.stderr
for args,expected in [([],module.explore()),(["--ending","slow","--positions","sinusoidal","--mask","bidirectional"],module.explore("slow","sinusoidal",False))]:
    r=subprocess.run([sys.executable,"attention.py",*args],cwd=BOOK,capture_output=True,text=True,check=True)
    compare(json.loads(r.stdout),expected)
names=["data.json","attention.py","test_attention.py","README.md"]
archive=ROOT/"public/downloads/chapter-24-attention.zip"
with zipfile.ZipFile(archive,"w",zipfile.ZIP_DEFLATED) as z:
    for name in names: z.write(BOOK/name,name)
with zipfile.ZipFile(archive) as z:
    assert sorted(z.namelist())==sorted(names)
    for name in names: assert z.read(name)==(BOOK/name).read_bytes()
print(json.dumps({"passed":True,"python_test_groups":8,"parity_reports":len(cases),"zip_files":names}))
