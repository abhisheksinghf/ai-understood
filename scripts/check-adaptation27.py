"""Check independent Python/JS rules, CLI semantics, and workbook packaging."""
import importlib.util
import itertools
import json
from pathlib import Path
import subprocess
import sys
import zipfile
sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent.parent
BOOK = ROOT/'public/downloads/chapter-27-adaptation'
spec = importlib.util.spec_from_file_location('adaptation27', BOOK/'adaptation.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
subprocess.run([sys.executable, '-B', '-m', 'unittest', '-v', 'test_adaptation.py'], cwd=BOOK, check=True)
configs = [dict(knowledge=k['id'], **dict(zip(module.FLAGS, values)))
           for k in module.DATA['knowledge'] for values in itertools.product([False, True], repeat=5)]
designs = [dict(zip(module.DESIGN_KEYS, values)) for values in itertools.product([False, True], repeat=4)]
program = ('import {plan,assess} from "./src/lib/adaptation.mjs"; const configs='+json.dumps(configs)+';const designs='+json.dumps(designs)+';console.log(JSON.stringify(configs.map(c=>({plan:plan(c),assessments:designs.map(d=>assess(c,d))}))));')
# stdin avoids the Windows command-line length limit.
run = subprocess.run(['node', '--input-type=module'], input=program, cwd=ROOT, encoding='utf-8', capture_output=True, check=True)
actual = json.loads(run.stdout)
for config, result in zip(configs, actual):
    assert module.plan(config) == result['plan']
    assert [module.assess(config, d) for d in designs] == result['assessments']
assert len(actual) == 128
for scenario, choices, ready in [('hybrid', [], False), ('hybrid', ['fineTune'], False), ('hybrid', ['rag','readTool','writeTool'], False), ('behavior', ['fineTune'], True)]:
    args = ['--scenario', scenario, '--design', ','.join(choices)]+(['--ready'] if ready else [])
    cli = json.loads(subprocess.check_output([sys.executable, '-B', 'adaptation.py', *args], cwd=BOOK, encoding='utf-8'))
    config = dict(next(s['config'] for s in module.DATA['scenarios'] if s['id'] == scenario))
    if ready: config.update(baselineTested=True, examplesReady=True, evalReady=True)
    design = {k: k in choices for k in module.DESIGN_KEYS}
    assert cli == dict(plan=module.plan(config), assessment=module.assess(config, design))
for args in [['--scenario','unknown'], ['--design','rag,rag'], ['--design','prompt'], ['--design','rag,'], ['--design','RAG']]:
    assert subprocess.run([sys.executable, '-B', 'adaptation.py', *args], cwd=BOOK, capture_output=True).returncode == 2
files = ['data.json','adaptation.py','test_adaptation.py','README.md']
with zipfile.ZipFile(BOOK.with_suffix('.zip'), 'w', zipfile.ZIP_DEFLATED) as z:
    for name in files: z.write(BOOK/name, name)
with zipfile.ZipFile(BOOK.with_suffix('.zip')) as z:
    assert sorted(z.namelist()) == sorted(files)
    for name in files: assert z.read(name) == (BOOK/name).read_bytes()
print(json.dumps(dict(passed=True, plans=len(configs), assessments=len(configs)*len(designs), cli_checks=9, zip_files=4)))
