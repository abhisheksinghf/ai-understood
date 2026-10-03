from pathlib import Path
import itertools
import json
import subprocess
import sys
import unittest
import zipfile
sys.dont_write_bytecode=True
root=Path(__file__).resolve().parent.parent
workbook=root/'public/downloads/chapter-38-reinforcement'
sys.path.insert(0,str(workbook))
from reinforcement import evaluate, CHOICES
result=unittest.TextTestRunner(verbosity=1).run(unittest.defaultTestLoader.discover(str(workbook),pattern='test_reinforcement.py'))
assert result.wasSuccessful()
configs=[dict(zip(CHOICES,values)) for values in itertools.product(*CHOICES.values())]
code="import {evaluate} from './src/lib/reinforcement.mjs';let t='';for await(const c of process.stdin)t+=c;console.log(JSON.stringify(JSON.parse(t).map(evaluate)));"
js=json.loads(subprocess.check_output(['node','--input-type=module','-e',code],cwd=root,input=json.dumps(configs),text=True,encoding='utf-8'))
assert len(js)==len(configs)==144
for c,j in zip(configs,js):assert evaluate(c)==j,c
cases=[([],{}),(['--epsilon','0'],dict(epsilon=0)),(['--gamma','0'],dict(gamma=0)),(['--objective','clicks'],dict(objective='clicks')),(['--episodes','60'],dict(episodes=60)),(['--seed','19','--alpha','0.1'],dict(seed=19,alpha=.1))]
for args,c in cases:
 output=subprocess.check_output([sys.executable,'-B',str(workbook/'reinforcement.py'),*args],text=True)
 assert json.loads(output)==evaluate(c)
for args in (['--episodes','0'],['--epsilon','-1'],['--gamma','1.5'],['--objective','profit']):
 assert subprocess.run([sys.executable,'-B',str(workbook/'reinforcement.py'),*args],capture_output=True).returncode!=0
with zipfile.ZipFile(workbook.with_suffix('.zip')) as z:
 assert set(z.namelist())=={'data.json','reinforcement.py','test_reinforcement.py','README.md'}
 for name in z.namelist():assert z.read(name)==(workbook/name).read_bytes()
print(json.dumps(dict(passed=True,python_tests=result.testsRun,parity_reports=len(configs),cli_checks=10,zip_files=4)))
