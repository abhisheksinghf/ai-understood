"""Verify numerical behavior and cross-runtime parity, then package the workbook."""
import importlib.util
import itertools
import json
import math
from pathlib import Path
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parent.parent
BOOK = ROOT/"public/downloads/chapter-23-language"
spec = importlib.util.spec_from_file_location("language23",BOOK/"language.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
subprocess.run([sys.executable,"-m","unittest","-v","test_language.py"],cwd=BOOK,check=True)
texts = [*module.DATA["samples"],"","\ufeffthis\nmovie\t"]
cases = [("tokenize",list(c)) for c in itertools.product(texts,(0,8,16,24))]
cases += [("explore",list(c)) for c in itertools.product(module.DATA["prefixes"],(0,1),(.5,1,2),(0,3),("greedy","sample"),module.DATA["scores"])]
program = 'import * as m from "./src/lib/language-model.mjs"; console.log(JSON.stringify('+json.dumps(cases)+'.map(([fn,args])=>m[fn](...args))));'
reports = json.loads(subprocess.check_output(["node","--input-type=module","-e",program],cwd=ROOT,encoding="utf-8"))


def compare(a,b,at="root"):
    if isinstance(a,dict):
        assert a.keys() == b.keys(),at
        for k in a: compare(a[k],b[k],at+"."+k)
    elif isinstance(a,list):
        assert len(a) == len(b),at
        for i,(x,y) in enumerate(zip(a,b)): compare(x,y,at+f"[{i}]")
    elif isinstance(a,(int,float)) and not isinstance(a,bool):
        assert math.isclose(a,b,abs_tol=1e-10,rel_tol=1e-10),(at,a,b)
    else: assert a == b,(at,a,b)


for (fn,args),report in zip(cases,reports):
    compare(getattr(module,fn)(*args),report,fn+str(args))
for args in [["tokenize","--merges","25"],["tokenize","--text","x"*201],["model","--alpha","-1"],["model","--temperature","0"],["model","--top-k","2"],["model","--score-case","bad"],[]]:
    r = subprocess.run([sys.executable,"language.py",*args],cwd=BOOK,capture_output=True,text=True)
    assert r.returncode == 2 and "error:" in r.stderr,args
for args,expected in [(["tokenize"],module.tokenize()),(["model","--method","greedy"],module.explore(method="greedy")),(["model","--alpha","0","--score-case","unknown"],module.explore(alpha=0,score_case="unknown"))]:
    r = subprocess.run([sys.executable,"language.py",*args],cwd=BOOK,capture_output=True,text=True,check=True)
    compare(json.loads(r.stdout),expected)
names = ["data.json","language.py","test_language.py","README.md"]
archive = ROOT/"public/downloads/chapter-23-language.zip"
with zipfile.ZipFile(archive,"w",zipfile.ZIP_DEFLATED) as z:
    for name in names: z.write(BOOK/name,name)
with zipfile.ZipFile(archive) as z:
    assert sorted(z.namelist()) == sorted(names)
    for name in names: assert z.read(name) == (BOOK/name).read_bytes()
print(json.dumps({"passed":True,"python_test_groups":10,"parity_cases":len(cases),"zip_files":names}))
