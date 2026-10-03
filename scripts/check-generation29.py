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
BOOK=ROOT/'public/downloads/chapter-29-generation'
spec=importlib.util.spec_from_file_location('generation29',BOOK/'generation.py')
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
subprocess.run([sys.executable,'-B','-m','unittest','-v','test_generation.py'],cwd=BOOK,check=True)
corruptions=list(itertools.product(['calm','adventure'],[7,42,123],range(1,8),['conditional','unconditional','oracle']))
generations=list(itertools.product(['calm','adventure'],[7,42,123],[0,1,3,7],[4,8,16]))
program='import {corruption,generate} from "./src/lib/generation.mjs";console.log(JSON.stringify({corruption:'+json.dumps(corruptions)+'.map(a=>corruption(...a)),generation:'+json.dumps(generations)+'.map(a=>generate(...a))}));'
run=subprocess.run(['node','--input-type=module'],input=program,cwd=ROOT,encoding='utf-8',capture_output=True,check=True)
actual=json.loads(run.stdout)
def compare(a,b):
    if isinstance(b,dict):
        assert a.keys()==b.keys()
        for key in b:compare(a[key],b[key])
    elif isinstance(b,list):
        assert len(a)==len(b)
        for x,y in zip(a,b):compare(x,y)
    elif isinstance(b,(int,float)):assert math.isclose(a,b,rel_tol=1e-10,abs_tol=1e-11),(a,b)
    else:assert a==b
for args,row in zip(corruptions,actual['corruption']):compare(module.corruption(*args),row)
for args,row in zip(generations,actual['generation']):compare(module.generate(*args),row)
for args,expected in [([],dict(corruption=module.corruption(),generation=module.generate())),(['--level','7','--estimator','oracle'],dict(corruption=module.corruption(level=7,estimator='oracle'),generation=module.generate())),(['--style','adventure','--guidance','3','--steps','16','--seed','7'],dict(corruption=module.corruption('adventure',7),generation=module.generate('adventure',7,3,16)))]:
    compare(json.loads(subprocess.check_output([sys.executable,'-B','generation.py',*args],cwd=BOOK,encoding='utf-8')),expected)
invalid=[['--style','other'],['--seed','0'],['--level','0'],['--level','8'],['--level','1.5'],['--estimator','other'],['--guidance','2'],['--steps','3']]
for args in invalid:assert subprocess.run([sys.executable,'-B','generation.py',*args],cwd=BOOK,capture_output=True).returncode==2
files=['data.json','generation.py','test_generation.py','README.md']
with zipfile.ZipFile(BOOK.with_suffix('.zip'),'w',zipfile.ZIP_DEFLATED) as z:
    for name in files:z.write(BOOK/name,name)
with zipfile.ZipFile(BOOK.with_suffix('.zip')) as z:
    assert sorted(z.namelist())==sorted(files)
    for name in files:assert z.read(name)==(BOOK/name).read_bytes()
print(json.dumps(dict(passed=True,corruption_reports=len(corruptions),generation_reports=len(generations),cli_checks=3+len(invalid),zip_files=4)))
