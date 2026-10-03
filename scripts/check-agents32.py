from pathlib import Path
import itertools
import json
import subprocess
import sys
import unittest
import zipfile
sys.dont_write_bytecode=True
root=Path(__file__).resolve().parent.parent
workbook=root/'public/downloads/chapter-32-agents'
sys.path.insert(0,str(workbook))
from agents import DATA, run_agent
suite=unittest.defaultTestLoader.discover(str(workbook),pattern='test_agents.py')
result=unittest.TextTestRunner(verbosity=1).run(suite)
assert result.wasSuccessful()
configs=[dict(scenario=s['id'],policy=p['id'],maxTurns=t,maxTools=n,loopGuard=g)
         for s,p,t,n,g in itertools.product(DATA['scenarios'],DATA['policies'],(2,3,4,6),(1,2,3,4),(True,False))]
code="import {runAgent} from './src/lib/agents.mjs'; let t=''; for await (const c of process.stdin)t+=c; console.log(JSON.stringify(JSON.parse(t).map(runAgent)));"
js=json.loads(subprocess.check_output(['node','--input-type=module','-e',code],cwd=root,input=json.dumps(configs),text=True,encoding='utf-8'))
assert len(js)==len(configs)
for c,j in zip(configs,js):assert run_agent(c)==j,c
cli_cases=[([],{}),(['--scenario','normal'],dict(scenario='normal')),(['--policy','forgetful'],dict(policy='forgetful')),(['--policy','forgetful','--no-loop-guard'],dict(policy='forgetful',loopGuard=False)),(['--scenario','malicious_note','--policy','gullible'],dict(scenario='malicious_note',policy='gullible')),(['--max-turns','3'],dict(maxTurns=3)),(['--max-tools','1'],dict(maxTools=1))]
for args,config in cli_cases:
 r=subprocess.run([sys.executable,'-B',str(workbook/'agents.py'),*args],capture_output=True,text=True,check=True)
 assert json.loads(r.stdout)==run_agent(config)
for args in [['--scenario','x'],['--policy','x'],['--max-turns','0'],['--max-tools','5'],['--unknown']]:
 assert subprocess.run([sys.executable,'-B',str(workbook/'agents.py'),*args],capture_output=True).returncode!=0
with zipfile.ZipFile(workbook.with_suffix('.zip')) as z:
 assert set(z.namelist())=={'data.json','agents.py','test_agents.py','README.md'}
 for name in z.namelist():assert z.read(name)==(workbook/name).read_bytes()
print(json.dumps(dict(python_tests=result.testsRun,parity_reports=len(configs),cli_checks=12,zip_files=4,passed=True)))
