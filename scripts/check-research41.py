from pathlib import Path
import itertools
import json
import subprocess
import sys
import unittest
import zipfile
sys.dont_write_bytecode=True
root=Path(__file__).resolve().parent.parent
workbook=root/'public/downloads/chapter-41-research'
sys.path.insert(0,str(workbook))
from research import evaluate, CHOICES
result=unittest.TextTestRunner(verbosity=1).run(unittest.defaultTestLoader.discover(str(workbook),pattern='test_research.py'))
assert result.wasSuccessful()
configs=[dict(zip(CHOICES,values)) for values in itertools.product(*CHOICES.values())]
code="import {evaluate} from './src/lib/research.mjs';let t='';for await(const c of process.stdin)t+=c;console.log(JSON.stringify(JSON.parse(t).map(evaluate)));"
js=json.loads(subprocess.check_output(['node','--input-type=module','-e',code],cwd=root,input=json.dumps(configs),text=True,encoding='utf-8'))
assert len(js)==len(configs)==144
for c,j in zip(configs,js):assert evaluate(c)==j,c
cases=[([],{}),(['--overlap','exclude'],dict(overlap='exclude')),(['--scope','facts','--overlap','exclude'],dict(scope='facts',overlap='exclude')),(['--sample','400'],dict(sample=400)),(['--protocol','unequal'],dict(protocol='unequal')),(['--remove','both'],dict(remove='both'))]
for args,c in cases:
 output=subprocess.check_output([sys.executable,'-B',str(workbook/'research.py'),*args],text=True)
 assert json.loads(output)==evaluate(c)
for args in (['--sample','0'],['--scope','hidden'],['--overlap','false'],['--remove','model']):
 assert subprocess.run([sys.executable,'-B',str(workbook/'research.py'),*args],capture_output=True).returncode!=0
with zipfile.ZipFile(workbook.with_suffix('.zip')) as z:
 assert set(z.namelist())=={'data.json','research.py','test_research.py','README.md'}
 for name in z.namelist():assert z.read(name)==(workbook/name).read_bytes()
print(json.dumps(dict(passed=True,python_tests=result.testsRun,parity_reports=len(configs),cli_checks=10,zip_files=4)))
