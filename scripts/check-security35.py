from pathlib import Path
import itertools
import json
import subprocess
import sys
import unittest
import zipfile
sys.dont_write_bytecode=True
root=Path(__file__).resolve().parent.parent
workbook=root/'public/downloads/chapter-35-security'
sys.path.insert(0,str(workbook))
from security import evaluate
result=unittest.TextTestRunner(verbosity=1).run(unittest.defaultTestLoader.discover(str(workbook),pattern='test_security.py'))
assert result.wasSuccessful()
configs=[dict(mode=m,slice=s,context=c,approval=a) for m,s,c,a in itertools.product(('keyword','boundaries'),('all','legitimate','adversarial'),('minimal','excessive'),('matched','missing','stale'))]
code="import {evaluate} from './src/lib/aiSecurity.mjs';let t='';for await(const c of process.stdin)t+=c;console.log(JSON.stringify(JSON.parse(t).map(evaluate)));"
js=json.loads(subprocess.check_output(['node','--input-type=module','-e',code],cwd=root,input=json.dumps(configs),text=True,encoding='utf-8'))
assert len(js)==len(configs)
for c,j in zip(configs,js):assert evaluate(c)==j,c
cases=[([],{}),(['--mode','keyword'],dict(mode='keyword')),(['--approval','missing'],dict(approval='missing')),(['--approval','stale'],dict(approval='stale')),(['--context','excessive'],dict(context='excessive')),(['--mode','keyword','--slice','legitimate'],dict(mode='keyword',slice='legitimate'))]
for args,c in cases:
 out=subprocess.check_output([sys.executable,'-B',str(workbook/'security.py'),*args],text=True)
 assert json.loads(out)==evaluate(c)
for args in (['--mode','x'],['--approval','yes'],['--slice','x'],['--context','private']):
 assert subprocess.run([sys.executable,'-B',str(workbook/'security.py'),*args],capture_output=True).returncode!=0
with zipfile.ZipFile(workbook.with_suffix('.zip')) as z:
 assert set(z.namelist())=={'data.json','security.py','test_security.py','README.md'}
 for name in z.namelist():assert z.read(name)==(workbook/name).read_bytes()
print(json.dumps(dict(passed=True,python_tests=result.testsRun,parity_reports=len(configs),cli_checks=10,zip_files=4)))
