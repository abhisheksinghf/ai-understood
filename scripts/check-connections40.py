from pathlib import Path
import itertools
import json
import subprocess
import sys
import unittest
import zipfile
sys.dont_write_bytecode=True
root=Path(__file__).resolve().parent.parent
workbook=root/'public/downloads/chapter-40-connections'
sys.path.insert(0,str(workbook))
from connections import evaluate, CHOICES
result=unittest.TextTestRunner(verbosity=1).run(unittest.defaultTestLoader.discover(str(workbook),pattern='test_connections.py'))
assert result.wasSuccessful()
configs=[dict(zip(CHOICES,values)) for values in itertools.product(*CHOICES.values())]
code="import {evaluate} from './src/lib/connections.mjs';let t='';for await(const c of process.stdin)t+=c;console.log(JSON.stringify(JSON.parse(t).map(evaluate)));"
js=json.loads(subprocess.check_output(['node','--input-type=module','-e',code],cwd=root,input=json.dumps(configs),text=True,encoding='utf-8'))
assert len(js)==len(configs)==144
for c,j in zip(configs,js):assert evaluate(c)==j,c
cases=[([],{}),(['--steps','3'],dict(steps=3)),(['--topology','shortcut'],dict(topology='shortcut')),(['--allocation','balanced'],dict(allocation='balanced')),(['--targetHigh','0.75'],dict(targetHigh=.75)),(['--strategy','confident','--budget','1'],dict(strategy='confident',budget=1))]
for args,c in cases:
 output=subprocess.check_output([sys.executable,'-B',str(workbook/'connections.py'),*args],text=True)
 assert json.loads(output)==evaluate(c)
for args in (['--steps','2'],['--targetHigh','1'],['--budget','0'],['--strategy','labels']):
 assert subprocess.run([sys.executable,'-B',str(workbook/'connections.py'),*args],capture_output=True).returncode!=0
with zipfile.ZipFile(workbook.with_suffix('.zip')) as z:
 assert set(z.namelist())=={'data.json','connections.py','test_connections.py','README.md'}
 for name in z.namelist():assert z.read(name)==(workbook/name).read_bytes()
print(json.dumps(dict(passed=True,python_tests=result.testsRun,parity_reports=len(configs),cli_checks=10,zip_files=4)))
