from pathlib import Path
import itertools
import json
import subprocess
import sys
import unittest
import zipfile
sys.dont_write_bytecode = True
root = Path(__file__).resolve().parent.parent
workbook = root / 'public/downloads/chapter-33-coordination'
sys.path.insert(0, str(workbook))
from coordination import DATA, run_coordination, protocol_transcript
result = unittest.TextTestRunner(verbosity=1).run(unittest.defaultTestLoader.discover(str(workbook), pattern='test_coordination.py'))
assert result.wasSuccessful()
configs = [dict(scenario=s['id'], pattern=p, schedule=t, budget=b, validate=v) for s, p, t, b, v in itertools.product(DATA['scenarios'], ('manager','handoff'), ('parallel','sequential'), (1,2,3), (True,False))]
code = "import {runCoordination,protocolTranscript} from './src/lib/coordination.mjs'; let t='';for await(const c of process.stdin)t+=c;console.log(JSON.stringify({runs:JSON.parse(t).map(runCoordination),protocol:protocolTranscript()}));"
js = json.loads(subprocess.check_output(['node','--input-type=module','-e',code], cwd=root, input=json.dumps(configs), text=True, encoding='utf-8'))
assert len(js['runs']) == len(configs)
for c, j in zip(configs, js['runs']):
    assert run_coordination(c) == j, c
assert protocol_transcript() == js['protocol']
cases = [([],{}), (['--schedule','sequential'],dict(schedule='sequential')), (['--pattern','handoff'],dict(pattern='handoff')), (['--scenario','wrong_region','--no-validation'],dict(scenario='wrong_region',validate=False)), (['--budget','2'],dict(budget=2))]
for args, c in cases:
    out = subprocess.check_output([sys.executable,'-B',str(workbook/'coordination.py'),*args], text=True)
    assert json.loads(out) == run_coordination(c)
assert json.loads(subprocess.check_output([sys.executable,'-B',str(workbook/'coordination.py'),'--protocol'],text=True)) == protocol_transcript()
for args in (['--budget','0'],['--scenario','x'],['--pattern','x'],['--schedule','x']):
    assert subprocess.run([sys.executable,'-B',str(workbook/'coordination.py'),*args],capture_output=True).returncode != 0
with zipfile.ZipFile(workbook.with_suffix('.zip')) as z:
    assert set(z.namelist()) == {'data.json','coordination.py','test_coordination.py','README.md'}
    for name in z.namelist():
        assert z.read(name) == (workbook/name).read_bytes()
print(json.dumps(dict(passed=True, python_tests=result.testsRun, parity_reports=len(configs), cli_checks=10, protocol_messages=7, zip_files=4)))
