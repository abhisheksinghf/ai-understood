from pathlib import Path
import json
import math
import subprocess
import sys
import tempfile
import zipfile

root = Path(__file__).resolve().parent.parent
project = root/'public/downloads/chapter-12-data-preparation'
sys.path.insert(0, str(project))
import prepare_data as prep

subprocess.run([sys.executable, '-m', 'unittest', '-v', 'test_prepare_data.py'], cwd=project, check=True)
rows = prep.read_csv(project/'raw_watch_events.csv')
plan = json.loads((project/'split_plan.json').read_text(encoding='utf-8'))
assert rows == json.loads((project/'raw_watch_events.json').read_text(encoding='utf-8'))
modes = [('median', 'train'), ('mean', 'train'), ('median', 'all'), ('mean', 'all')]
expected = [prep.prepare_data(rows, plan, strategy, scope) for strategy, scope in modes]
javascript = "import {prepareData} from './src/lib/data-preparation.mjs'; console.log(JSON.stringify([['median','train'],['mean','train'],['median','all'],['mean','all']].map(([s,f])=>prepareData(s,f))));"
actual = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', javascript], cwd=root, text=True, encoding='utf-8'))


def equal(a, b):
    if isinstance(a, dict):
        assert a.keys() == b.keys()
        for key in a:
            equal(a[key], b[key])
    elif isinstance(a, list):
        assert len(a) == len(b)
        for x, y in zip(a, b):
            equal(x, y)
    elif isinstance(a, (int, float)) and not isinstance(a, bool):
        assert math.isclose(a, b, rel_tol=1e-12, abs_tol=1e-12), (a, b)
    else:
        assert a == b, (a, b)


equal(actual, expected)
with tempfile.TemporaryDirectory() as directory:
    folder = Path(directory)

    def run(*args, expected_exit=0):
        before = set(folder.iterdir())
        p = subprocess.run([sys.executable, str(project/'prepare_data.py'), *args], cwd=folder, capture_output=True, text=True, encoding='utf-8')
        assert p.returncode == expected_exit, p.stdout+p.stderr
        assert set(folder.iterdir()) == before, 'CLI unexpectedly wrote a file'
        return json.loads(p.stdout)

    equal(run(), expected[0])
    equal(run('--strategy', 'mean'), expected[1])
    equal(run('--leaky-demo'), expected[2])
    equal(run('--leaky-demo', '--strategy', 'mean'), expected[3])
    source = folder/'bad.csv'
    source.write_text('wrong,header\n1,2\n', encoding='utf-8')
    assert run('--input', str(source), expected_exit=2)['status'] == 'invalid_input'
    split = folder/'bad-plan.json'
    split.write_text(json.dumps({**plan, 'test': ['U01']}), encoding='utf-8')
    assert run('--plan', str(split), expected_exit=2)['status'] == 'invalid_input'
    assert run('--input', str(folder/'absent.csv'), expected_exit=2)['status'] == 'invalid_input'

files = sorted(p for p in project.iterdir() if p.is_file() and p.suffix in ('.py', '.json', '.csv', '.md'))
assert len(files) == 6
archive = root/'public/downloads/chapter-12-data-preparation.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
    for file in files:
        z.write(file, file.name)
with zipfile.ZipFile(archive) as z:
    assert set(z.namelist()) == {p.name for p in files}
    for file in files:
        assert z.read(file.name) == file.read_bytes()
print(json.dumps({'passed': True, 'unitTests': 11, 'crossLanguageModes': 4, 'archiveFiles': 6, 'modelCalls': 0, 'checks': ['training independence', 'label exclusion', 'group boundaries', 'CSV/JSON parity', 'CLI outcomes', 'no file writes', 'ZIP contents']}))
