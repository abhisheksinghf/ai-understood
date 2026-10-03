from pathlib import Path
import itertools
import json
import subprocess
import sys
import unittest
import zipfile
sys.dont_write_bytecode=True
root=Path(__file__).resolve().parent.parent
workbook=root/'public/downloads/chapter-36-operations'
sys.path.insert(0,str(workbook))
from operations import evaluate
result=unittest.TextTestRunner(verbosity=1).run(unittest.defaultTestLoader.discover(str(workbook),pattern='test_operations.py'))
assert result.wasSuccessful()
configs=[dict(scenario=s,share=p,retries=r,deadline=d,rollback=b) for s,p,r,d,b in itertools.product(('healthy','bad_release','provider_fault'),(0,20,60,100),(0,1),(1200,2400),('automatic','observe'))]
code="import {evaluate} from './src/lib/operations.mjs';let t='';for await(const c of process.stdin)t+=c;console.log(JSON.stringify(JSON.parse(t).map(evaluate)));"
js=json.loads(subprocess.check_output(['node','--input-type=module','-e',code],cwd=root,input=json.dumps(configs),text=True,encoding='utf-8'))
assert len(js)==len(configs)
for c,j in zip(configs,js):assert evaluate(c)==j,c
cases=[([],{}),(['--rollback','observe'],dict(rollback='observe')),(['--share','100'],dict(share=100)),(['--scenario','provider_fault','--rollback','observe','--retries','0'],dict(scenario='provider_fault',rollback='observe',retries=0)),(['--scenario','provider_fault','--rollback','observe','--retries','1'],dict(scenario='provider_fault',rollback='observe',retries=1)),(['--scenario','provider_fault','--rollback','observe','--deadline','1200'],dict(scenario='provider_fault',rollback='observe',deadline=1200))]
for args,c in cases:
 out=subprocess.check_output([sys.executable,'-B',str(workbook/'operations.py'),*args],text=True)
 assert json.loads(out)==evaluate(c)
for args in (['--share','50'],['--retries','9'],['--scenario','x'],['--deadline','0']):
 assert subprocess.run([sys.executable,'-B',str(workbook/'operations.py'),*args],capture_output=True).returncode!=0
with zipfile.ZipFile(workbook.with_suffix('.zip')) as z:
 assert set(z.namelist())=={'data.json','operations.py','test_operations.py','README.md'}
 for name in z.namelist():assert z.read(name)==(workbook/name).read_bytes()
print(json.dumps(dict(passed=True,python_tests=result.testsRun,parity_reports=len(configs),cli_checks=10,zip_files=4)))
