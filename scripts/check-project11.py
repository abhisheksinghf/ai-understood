from pathlib import Path
import importlib.util
import json
import subprocess
import sys
import tempfile
import zipfile

root = Path(__file__).resolve().parent.parent
project = root/'public/downloads/chapter-11-movie-project'
sys.path.insert(0, str(project))
import study_app
from evaluate import evaluate

subprocess.run([sys.executable, '-m', 'unittest', '-v', 'test_study_app.py'], cwd=project, check=True)
catalog = study_app.load_json((project/'catalog.json').read_text(encoding='utf-8'))
cases = study_app.load_json((project/'eval_cases.json').read_text(encoding='utf-8'))
# Shared notes and evidence must stay consistent across the learning path.
notes05 = json.loads((root/'public/downloads/chapter-05-api/notes.json').read_text(encoding='utf-8'))
notes11 = {note['id']: note for note in catalog['notes']}
for note_id, original in notes05.items():
    for field in ('title', 'text', 'estimated_minutes'):
        assert notes11[note_id][field] == original[field], (note_id, field)
cases09 = json.loads((root/'public/downloads/chapter-09-prompting/cases.json').read_text(encoding='utf-8'))
sources10 = json.loads((root/'public/downloads/chapter-10-llm-app/sources.json').read_text(encoding='utf-8'))
assert sources10 == [{k: source[k] for k in ('id', 'text')} for source in cases09[0]['sources']]
assert notes05['N01']['text'] in sources10[1]['text']

expected = [study_app.recommend(c['preferences'], catalog) for c in cases]
javascript = "import {recommend} from './src/lib/movie-project.mjs'; import cases from './public/downloads/chapter-11-movie-project/eval_cases.json' with {type:'json'}; console.log(JSON.stringify(cases.map(c=>recommend(c.preferences))));"
output = subprocess.check_output(['node', '--input-type=module', '-e', javascript], cwd=root, text=True, encoding='utf-8')
assert json.loads(output) == expected, 'Browser/Python output drift'
core = (root/'public/downloads/chapter-10-llm-app/app.py').read_text(encoding='utf-8').split('def main():')[0]
assert (project/'llm_core.py').read_text(encoding='utf-8') == core
adapter = (root/'public/downloads/chapter-10-llm-app/provider.py').read_text(encoding='utf-8').replace('from app import load_json', 'from llm_core import load_json').replace('--live', '--draft live')
assert (project/'provider.py').read_text(encoding='utf-8') == adapter

def run(*args, expected_exit=0):
    p = subprocess.run([sys.executable, str(project/'study_app.py'), *args], cwd=root, capture_output=True, text=True, encoding='utf-8')
    assert p.returncode == expected_exit, p.stderr + p.stdout
    return json.loads(p.stdout)

assert run()['recommendation']['note_id'] == 'N01'
assert run('--draft', 'template')['draft']['status'] == 'review_required'
bad = run('--draft', 'unsupported')
assert bad['recommendation']['exam_date'] is None
assert bad['draft']['candidate']['exam_date'] == '2026-12-01 [S1]'
with tempfile.TemporaryDirectory() as temp:
    file = Path(temp)/'preferences.json'
    for case in cases:
        file.write_text(json.dumps(case['preferences']), encoding='utf-8')
        result = run('--preferences', str(file))
        assert (result['recommendation'] or {}).get('note_id') == case['expected_id']
    file.write_text(json.dumps({**study_app.DEFAULT, 'max_minutes': 10}), encoding='utf-8')
    # Even explicitly requested live mode does not initialize a provider on no match.
    result = run('--preferences', str(file), '--draft', 'live')
    assert result['draft']['attempts'] == 0
    file.write_text('{"topic":', encoding='utf-8')
    assert run('--preferences', str(file), expected_exit=2)['status'] == 'invalid_input_or_setup'
wrong = json.loads(json.dumps(cases));wrong[0]['expected_id'] = 'N05'
assert evaluate(catalog, wrong)['passed'] == 11
files = sorted(p for p in project.iterdir() if p.is_file() and p.suffix in ('.py', '.json', '.md'))
archive = root/'public/downloads/chapter-11-learning-project.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
    for file in files:
        z.write(file, file.name)
with zipfile.ZipFile(archive) as z:
    assert set(z.namelist()) == {p.name for p in files}
    for file in files:
        assert z.read(file.name) == file.read_bytes()
(root/'public/downloads/chapter-11-movie-project.zip').write_bytes(archive.read_bytes())
print(json.dumps({'passed': True, 'acceptanceCases': 12, 'crossLanguageMatches': 12, 'archiveFiles': len(files), 'liveCalls': 0, 'checks': ['boundaries and invariants', 'invalid inputs', 'deterministic ties', 'draft separation', 'fake HTTP', 'CLI outcomes', 'evaluation can fail', 'reused adapter parity', 'ZIP contents']}))
