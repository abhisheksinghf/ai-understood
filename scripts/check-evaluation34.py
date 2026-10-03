from pathlib import Path
import itertools
import json
import subprocess
import sys
import unittest
import zipfile
sys.dont_write_bytecode=True
root=Path(__file__).resolve().parent.parent
workbook=root/'public/downloads/chapter-34-evaluation'
sys.path.insert(0,str(workbook))
from evaluation import evaluate
result=unittest.TextTestRunner(verbosity=1).run(unittest.defaultTestLoader.discover(str(workbook),pattern='test_evaluation.py'))
assert result.wasSuccessful()
configs=[dict(variant=v,slice=s,trial=t,minSuccess=q,maxLatency=l) for v,s,t,q,l in itertools.product(('candidate','guarded'),('all','routine','edge','action'),('all','1','2'),(60,75,90),(1800,2500,3000))]
code="import {evaluate} from './src/lib/systemEvaluation.mjs';let t='';for await(const c of process.stdin)t+=c;console.log(JSON.stringify(JSON.parse(t).map(evaluate)));"
js=json.loads(subprocess.check_output(['node','--input-type=module','-e',code],cwd=root,input=json.dumps(configs),text=True,encoding='utf-8'))
assert len(js)==len(configs)
for c,j in zip(configs,js):assert evaluate(c)==j,c
cases=[([],{}),(['--variant','guarded'],dict(variant='guarded')),(['--slice','routine','--trial','1'],dict(slice='routine',trial='1')),(['--slice','action'],dict(slice='action')),(['--variant','guarded','--min-success','90'],dict(variant='guarded',minSuccess=90)),(['--variant','guarded','--max-latency','2500'],dict(variant='guarded',maxLatency=2500))]
for args,c in cases:
 out=subprocess.check_output([sys.executable,'-B',str(workbook/'evaluation.py'),*args],text=True)
 assert json.loads(out)==evaluate(c)
for args in (['--variant','x'],['--trial','0'],['--slice','x'],['--min-success','0']):
 assert subprocess.run([sys.executable,'-B',str(workbook/'evaluation.py'),*args],capture_output=True).returncode!=0
with zipfile.ZipFile(workbook.with_suffix('.zip')) as z:
 assert set(z.namelist())=={'data.json','evaluation.py','test_evaluation.py','README.md'}
 for name in z.namelist():assert z.read(name)==(workbook/name).read_bytes()
print(json.dumps(dict(passed=True,python_tests=result.testsRun,parity_reports=len(configs),cli_checks=10,zip_files=4)))
