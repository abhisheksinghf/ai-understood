from pathlib import Path
import itertools
import json
import subprocess
import sys
import unittest
import zipfile
sys.dont_write_bytecode=True
root=Path(__file__).resolve().parent.parent
workbook=root/'public/downloads/chapter-31-workflows'
sys.path.insert(0,str(workbook))
from workflows import DATA, run_workflow
suite=unittest.defaultTestLoader.discover(str(workbook),pattern='test_workflows.py')
result=unittest.TextTestRunner(verbosity=1).run(suite)
assert result.wasSuccessful()
configs=[dict(scenario=s['id'],retries=r,budget=b,canWrite=p,authorized=a,deduplicate=d)
         for s,r,b,p,a,d in itertools.product(DATA['scenarios'],range(3),range(1,5),(True,False),(True,False),(True,False))]
code="import {runWorkflow} from './src/lib/workflows.mjs'; let t=''; for await (const c of process.stdin)t+=c; console.log(JSON.stringify(JSON.parse(t).map(runWorkflow)));"
js=json.loads(subprocess.check_output(['node','--input-type=module','-e',code],cwd=root,input=json.dumps(configs),text=True,encoding='utf-8'))
for c,j in zip(configs,js):
 assert run_workflow(c)==j,c
cli_cases=[([],{}),(['--scenario','lost_receipt'],dict(scenario='lost_receipt')),(['--scenario','lost_receipt','--no-deduplicate'],dict(scenario='lost_receipt',deduplicate=False)),(['--deny-write'],dict(canWrite=False)),(['--no-authorization'],dict(authorized=False)),(['--budget','1'],dict(budget=1)),(['--retries','0'],dict(retries=0))]
for args,config in cli_cases:
 r=subprocess.run([sys.executable,'-B',str(workbook/'workflows.py'),*args],capture_output=True,text=True,check=True)
 assert json.loads(r.stdout)==run_workflow(config)
for args in [['--scenario','x'],['--retries','3'],['--budget','0'],['--unknown']]:
 assert subprocess.run([sys.executable,'-B',str(workbook/'workflows.py'),*args],capture_output=True).returncode!=0
with zipfile.ZipFile(workbook.with_suffix('.zip')) as z:
 assert set(z.namelist())=={'data.json','workflows.py','test_workflows.py','README.md'}
 for name in z.namelist():assert z.read(name)==(workbook/name).read_bytes()
print(json.dumps(dict(python_tests=result.testsRun,parity_reports=len(configs),cli_checks=11,zip_files=4,passed=True)))
