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
import movie_app
from evaluate import evaluate

subprocess.run([sys.executable, '-m', 'unittest', '-v', 'test_movie_app.py'], cwd=project, check=True)
catalog = movie_app.load_json((project/'catalog.json').read_text(encoding='utf-8'))
cases = movie_app.load_json((project/'eval_cases.json').read_text(encoding='utf-8'))
expected = [movie_app.recommend(c['preferences'], catalog) for c in cases]
javascript = "import {recommend} from './src/lib/movie-project.mjs'; import cases from './public/downloads/chapter-11-movie-project/eval_cases.json' with {type:'json'}; console.log(JSON.stringify(cases.map(c=>recommend(c.preferences))));"
output = subprocess.check_output(['node', '--input-type=module', '-e', javascript], cwd=root, text=True, encoding='utf-8')
assert json.loads(output) == expected, 'Browser/Python output drift'
core = (root/'public/downloads/chapter-10-llm-app/app.py').read_text(encoding='utf-8').split('def main():')[0]
assert (project/'llm_core.py').read_text(encoding='utf-8') == core
adapter = (root/'public/downloads/chapter-10-llm-app/provider.py').read_text(encoding='utf-8').replace('from app import load_json', 'from llm_core import load_json').replace('--live', '--draft live')
assert (project/'provider.py').read_text(encoding='utf-8') == adapter

def run(*args, expected_exit=0):
    p = subprocess.run([sys.executable, str(project/'movie_app.py'), *args], cwd=root, capture_output=True, text=True, encoding='utf-8')
    assert p.returncode == expected_exit, p.stderr + p.stdout
    return json.loads(p.stdout)

assert run()['recommendation']['movie_id'] == 'M001'
assert run('--draft', 'template')['draft']['status'] == 'review_required'
bad = run('--draft', 'unsupported')
assert bad['recommendation']['streaming_service'] is None
assert bad['draft']['candidate']['streaming_service'] == 'ExampleFlix [S1]'
with tempfile.TemporaryDirectory() as temp:
    file = Path(temp)/'preferences.json'
    for case in cases:
        file.write_text(json.dumps(case['preferences']), encoding='utf-8')
        result = run('--preferences', str(file))
        assert (result['recommendation'] or {}).get('movie_id') == case['expected_id']
    file.write_text(json.dumps({**movie_app.DEFAULT, 'max_minutes': 90}), encoding='utf-8')
    # Even explicitly requested live mode does not initialize a provider on no match.
    result = run('--preferences', str(file), '--draft', 'live')
    assert result['draft']['attempts'] == 0
    file.write_text('{"genre":', encoding='utf-8')
    assert run('--preferences', str(file), expected_exit=2)['status'] == 'invalid_input_or_setup'
wrong = json.loads(json.dumps(cases));wrong[0]['expected_id'] = 'M002'
assert evaluate(catalog, wrong)['passed'] == 11
files = sorted(p for p in project.iterdir() if p.is_file() and p.suffix in ('.py', '.json', '.md'))
archive = root/'public/downloads/chapter-11-movie-project.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
    for file in files:
        z.write(file, file.name)
with zipfile.ZipFile(archive) as z:
    assert set(z.namelist()) == {p.name for p in files}
    for file in files:
        assert z.read(file.name) == file.read_bytes()
print(json.dumps({'passed': True, 'acceptanceCases': 12, 'crossLanguageMatches': 12, 'archiveFiles': len(files), 'liveCalls': 0, 'checks': ['boundaries and invariants', 'invalid inputs', 'deterministic ties', 'draft separation', 'fake HTTP', 'CLI outcomes', 'evaluation can fail', 'reused adapter parity', 'ZIP contents']}))
