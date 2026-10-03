"""Verify gradients, runtime parity, CLI contracts, and the four-file workbook."""
import importlib.util
import itertools
import json
import math
from pathlib import Path
import subprocess
import sys
import zipfile
ROOT=Path(__file__).resolve().parent.parent
BOOK=ROOT/'public/downloads/chapter-25-lifecycle'
spec=importlib.util.spec_from_file_location('lifecycle25',BOOK/'lifecycle.py')
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
subprocess.run([sys.executable,'-m','unittest','-v','test_lifecycle.py'],cwd=BOOK,check=True)
configs=list(itertools.product(('reply','all'),(0,20,80)))
cases=list(itertools.product(('initial','pretrained','adapted'),('comedy','drama','prose'),('greedy','sample'),(.75,1,1.5),(1,4,8)))
program='import {train,generate} from "./src/lib/llm-lifecycle.mjs"; const configs='+json.dumps(configs)+';const cases='+json.dumps(cases)+';console.log(JSON.stringify(configs.map(a=>{const r=train(...a);return {training:r,generation:cases.map(([c,...g])=>generate(r.checkpoints[c],...g))};})));'
reports=json.loads(subprocess.check_output(['node','--input-type=module','-e',program],cwd=ROOT,encoding='utf-8'))


def compare(a,b):
    if isinstance(a,dict):
        assert a.keys()==b.keys()
        for key in a: compare(a[key],b[key])
    elif isinstance(a,list):
        assert len(a)==len(b)
        for x,y in zip(a,b): compare(x,y)
    elif isinstance(a,(int,float)) and not isinstance(a,bool):
        assert math.isclose(a,b,abs_tol=1e-9,rel_tol=1e-9),(a,b)
    else: assert a==b,(a,b)


for config,report in zip(configs,reports):
    r=module.train(*config)
    compare(r,report['training'])
    for (checkpoint,*args),actual in zip(cases,report['generation']): compare(module.generate(r['checkpoints'][checkpoint],*args),actual)
for args in [['--mask','bad'],['--steps','1'],['--temperature','0'],['--limit','0'],['--checkpoint','bad']]:
    r=subprocess.run([sys.executable,'lifecycle.py',*args],cwd=BOOK,capture_output=True,text=True)
    assert r.returncode==2 and 'error:' in r.stderr
r=subprocess.run([sys.executable,'lifecycle.py'],cwd=BOOK,capture_output=True,text=True,check=True)
actual=json.loads(r.stdout)
expected=module.train()
compare(actual,{'training':expected,'checkpoint':'adapted','generation':module.generate(expected['checkpoints']['adapted'])})
names=['data.json','lifecycle.py','test_lifecycle.py','README.md']
archive=ROOT/'public/downloads/chapter-25-lifecycle.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for name in names:z.write(BOOK/name,name)
with zipfile.ZipFile(archive) as z:
    assert sorted(z.namelist())==sorted(names)
    for name in names:assert z.read(name)==(BOOK/name).read_bytes()
print(json.dumps({'passed':True,'python_test_groups':10,'training_reports':len(configs),'generation_reports':len(configs)*len(cases),'zip_files':names}))
