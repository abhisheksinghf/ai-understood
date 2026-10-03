from pathlib import Path
import importlib.util
import itertools
import json
import subprocess
import sys
import zipfile

root = Path(__file__).resolve().parent.parent
folder = root / 'public/downloads/chapter-42-capstone'
spec = importlib.util.spec_from_file_location('capstone', folder/'assistant.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
configs = [dict(zip(('constraints','aliases','tool'), c)) for c in itertools.product((True,False),(True,False),('online','timeout'))]
base = module.DATA['cases'][0]['request']
requests = [c['request'] for c in module.DATA['cases']] + [
    {'intent':'recommend','query':'detective comedy','max_minutes':100,'seen':[]},
    {'intent':'recommend','query':'space SPACE cosmic','max_minutes':200,'seen':[]},
    {**base,'max_minutes':105.0},{**base,'max_minutes':104},{**base,'max_minutes':True},
    {**base,'seen':['M001','M002']},{**base,'query':'!'},{**base,'unexpected':1},
    {'intent':'availability','movie_id':'M001','region':['IN']},
    {'intent':'availability','movie_id':'M001','region':'US'},
    {'intent':'runtime','movie_id':'M999'}, None, [], {}
]
script = """import {evaluate,run} from './src/lib/capstone.mjs';
let raw='';for await(const chunk of process.stdin)raw+=chunk;
const {configs,requests}=JSON.parse(raw);
console.log(JSON.stringify({reports:configs.map(evaluate),responses:configs.flatMap(c=>requests.map(r=>run(r,c)))}));"""
js = subprocess.run(['node','--input-type=module','-e',script],cwd=root,input=json.dumps({'configs':configs,'requests':requests}),text=True,capture_output=True,check=True)
expected = {'reports':[module.evaluate(c) for c in configs], 'responses':[module.run(r,c) for c in configs for r in requests]}
assert json.loads(js.stdout) == expected, 'JS/Python mismatch'
commands = [[],['--constraints','off','--aliases','off'],['--aliases','off'],['--tool','timeout']]+[['--case',c['id']] for c in module.DATA['cases']]
for args in commands:
    result = subprocess.run([sys.executable,'-B','assistant.py',*args],cwd=folder,text=True,capture_output=True,check=True)
    parsed = json.loads(result.stdout)
    if not args: assert parsed['passed'] == 8
    elif args[:2] == ['--constraints','off']: assert parsed['passed'] == 4
    elif args[:2] == ['--aliases','off']: assert parsed['passed'] == 7
    elif args[:2] == ['--tool','timeout']: assert parsed['toolFailures'] == 1
    else: assert parsed == module.run(next(c['request'] for c in module.DATA['cases'] if c['id']==args[1]))
out = root/'tmp/qa/chapter-42';out.mkdir(parents=True,exist_ok=True)
custom = out/'request.json';custom.write_text(json.dumps(requests[8]),encoding='utf-8')
result = subprocess.run([sys.executable,'-B','assistant.py','--request',str(custom)],cwd=folder,text=True,capture_output=True,check=True)
assert json.loads(result.stdout)['movie_id'] == 'M004'
with zipfile.ZipFile(folder.with_suffix('.zip')) as z:
    assert set(z.namelist()) == {'data.json','assistant.py','test_assistant.py','README.md'}
    for name in z.namelist(): assert z.read(name) == (folder/name).read_bytes(), name
report = {'passed':True,'parityReports':len(configs),'parityResponses':len(configs)*len(requests),'cliChecks':len(commands)+1,'zipFiles':4}
(out/'workbook-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report))
