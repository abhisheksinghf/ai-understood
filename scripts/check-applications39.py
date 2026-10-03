from pathlib import Path
import itertools
import json
import subprocess
import sys
import unittest
import zipfile
sys.dont_write_bytecode=True
root=Path(__file__).resolve().parent.parent
workbook=root/'public/downloads/chapter-39-applications'
sys.path.insert(0,str(workbook))
from applications import evaluate, CHOICES
result=unittest.TextTestRunner(verbosity=1).run(unittest.defaultTestLoader.discover(str(workbook),pattern='test_applications.py'))
assert result.wasSuccessful()
configs=[dict(zip(CHOICES,values)) for values in itertools.product(*CHOICES.values())]
code="import {evaluate} from './src/lib/applied-systems.mjs';let t='';for await(const c of process.stdin)t+=c;console.log(JSON.stringify(JSON.parse(t).map(evaluate)));"
js=json.loads(subprocess.check_output(['node','--input-type=module','-e',code],cwd=root,input=json.dumps(configs),text=True,encoding='utf-8'))
assert len(js)==len(configs)==54
for c,j in zip(configs,js):assert evaluate(c)==j,c
cases=[([],{}),(['--threshold','0.9'],dict(threshold=.9)),(['--weight','0'],dict(weight=0)),(['--weight','0.5','--k','3'],dict(weight=.5,k=3)),(['--forecast','last'],dict(forecast='last')),(['--forecast','mean3'],dict(forecast='mean3'))]
for args,c in cases:
 output=subprocess.check_output([sys.executable,'-B',str(workbook/'applications.py'),*args],text=True)
 assert json.loads(output)==evaluate(c)
for args in (['--threshold','2'],['--weight','-1'],['--k','0'],['--forecast','future']):
 assert subprocess.run([sys.executable,'-B',str(workbook/'applications.py'),*args],capture_output=True).returncode!=0
with zipfile.ZipFile(workbook.with_suffix('.zip')) as z:
 assert set(z.namelist())=={'data.json','applications.py','test_applications.py','README.md'}
 for name in z.namelist():assert z.read(name)==(workbook/name).read_bytes()
print(json.dumps(dict(passed=True,python_tests=result.testsRun,parity_reports=len(configs),cli_checks=10,zip_files=4)))
