import importlib.util
import itertools
import json
import math
from pathlib import Path
import subprocess
import sys
import zipfile
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parent.parent
BOOK=ROOT/'public/downloads/chapter-28-tuning'
spec=importlib.util.spec_from_file_location('tuning28',BOOK/'tuning.py')
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
subprocess.run([sys.executable,'-B','-m','unittest','-v','test_tuning.py'],cwd=BOOK,check=True)
loras=list(itertools.product([1,2],[1,2,4],['initial','adapted']))
prefs=list(itertools.product([0.2,0.5,0.8],[0.1,0.5,1],[0.1,0.5,1],[0,1,10,40],['A','B']))
program='import {lora,preference} from "./src/lib/tuning.mjs";console.log(JSON.stringify({lora:'+json.dumps(loras)+'.map(a=>lora(...a)),preference:'+json.dumps(prefs)+'.map(a=>preference(...a))}));'
run=subprocess.run(['node','--input-type=module'],input=program,cwd=ROOT,encoding='utf-8',capture_output=True,check=True)
actual=json.loads(run.stdout)
def compare(a,b):
    if isinstance(b,dict):
        assert a.keys()==b.keys()
        for key in b: compare(a[key],b[key])
    elif isinstance(b,list):
        assert len(a)==len(b)
        for x,y in zip(a,b): compare(x,y)
    elif isinstance(b,(int,float)): assert math.isclose(a,b,rel_tol=1e-11,abs_tol=1e-12),(a,b)
    else: assert a==b
for args,row in zip(loras,actual['lora']): compare(module.lora(*args),row)
for args,row in zip(prefs,actual['preference']): compare(module.preference(*args),row)
for args,expected in [([],dict(lora=module.lora(),preference=module.preference())),(['--steps','1','--chosen','B'],dict(lora=module.lora(),preference=module.preference(steps=1,chosen='B'))),(['--rank','2','--alpha','4','--stage','initial'],dict(lora=module.lora(2,4,'initial'),preference=module.preference()))]:
    compare(json.loads(subprocess.check_output([sys.executable,'-B','tuning.py',*args],cwd=BOOK,encoding='utf-8')),expected)
for args in [['--rank','3'],['--alpha','3'],['--stage','unknown'],['--reference','0'],['--beta','0'],['--rate','2'],['--steps','41'],['--steps','1.5'],['--chosen','C']]:
    assert subprocess.run([sys.executable,'-B','tuning.py',*args],cwd=BOOK,capture_output=True).returncode==2
files=['data.json','tuning.py','test_tuning.py','README.md']
with zipfile.ZipFile(BOOK.with_suffix('.zip'),'w',zipfile.ZIP_DEFLATED) as z:
    for name in files:z.write(BOOK/name,name)
with zipfile.ZipFile(BOOK.with_suffix('.zip')) as z:
    assert sorted(z.namelist())==sorted(files)
    for name in files:assert z.read(name)==(BOOK/name).read_bytes()
print(json.dumps(dict(passed=True,lora_reports=len(loras),preference_reports=len(prefs),cli_checks=12,zip_files=4)))
