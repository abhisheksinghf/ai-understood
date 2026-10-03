from pathlib import Path
import itertools
import json
import subprocess
import sys
import unittest
import zipfile
sys.dont_write_bytecode=True
root=Path(__file__).resolve().parent.parent
workbook=root/'public/downloads/chapter-37-reasoning'
sys.path.insert(0,str(workbook))
from reasoning import evaluate, CHOICES
result=unittest.TextTestRunner(verbosity=1).run(unittest.defaultTestLoader.discover(str(workbook),pattern='test_reasoning.py'))
assert result.wasSuccessful()
configs=[dict(zip(CHOICES,values)) for values in itertools.product(*CHOICES.values())]
code="import {evaluate} from './src/lib/reasoning.mjs';let t='';for await(const c of process.stdin)t+=c;console.log(JSON.stringify(JSON.parse(t).map(evaluate)));"
js=json.loads(subprocess.check_output(['node','--input-type=module','-e',code],cwd=root,input=json.dumps(configs),text=True,encoding='utf-8'))
assert len(js)==len(configs)==162
for c,j in zip(configs,js):assert evaluate(c)==j,c
cases=[([],{}),(['--minutes','120','--offline','no'],dict(minutes=120,offline='no')),(['--evidence','unknown','--penalty','10'],dict(evidence='unknown',penalty=10)),(['--minutes','80'],dict(minutes=80)),(['--prior','20','--evidence','disliked'],dict(prior=20,evidence='disliked'))]
for args,c in cases:
 output=subprocess.check_output([sys.executable,'-B',str(workbook/'reasoning.py'),*args],text=True)
 assert json.loads(output)==evaluate(c)
for args in (['--minutes','95'],['--evidence','maybe'],['--prior','0'],['--penalty','-1']):
 assert subprocess.run([sys.executable,'-B',str(workbook/'reasoning.py'),*args],capture_output=True).returncode!=0
with zipfile.ZipFile(workbook.with_suffix('.zip')) as z:
 assert set(z.namelist())=={'data.json','reasoning.py','test_reasoning.py','README.md'}
 for name in z.namelist():assert z.read(name)==(workbook/name).read_bytes()
print(json.dumps(dict(passed=True,python_tests=result.testsRun,parity_reports=len(configs),cli_checks=9,zip_files=4)))
