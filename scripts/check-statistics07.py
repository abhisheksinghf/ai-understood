"""Check the learner's real Python workbook, snippets, and archive."""
import contextlib
import importlib.util
import io
import json
import math
from pathlib import Path
import re
import subprocess
import sys
from zipfile import ZipFile, ZIP_DEFLATED

sys.dont_write_bytecode = True
root = Path(__file__).resolve().parent.parent
starter = root / 'public/downloads/chapter-07-statistics'
spec = importlib.util.spec_from_file_location('statistics07', starter / 'statistics_lab.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
default = module.alert_counts()
assert default['true_positive'] == 90 and default['false_positive'] == 495
assert math.isclose(default['precision'], 2/13)
assert math.isclose(module.alert_counts(base_rate=.1)['precision'], 2/3)
assert module.alert_counts(false_positive_rate=0)['precision'] == 1
assert module.alert_counts(base_rate=0)['precision'] == 0
assert module.alert_counts(recall=0, false_positive_rate=0)['precision'] is None
assert module.alert_counts(base_rate=.001)['false_positive'] == 499.5
for base in (0, .001, .01, .1, 1):
    for recall in (0, .9, 1):
        for fpr in (0, .05, 1):
            r = module.alert_counts(base_rate=base, recall=recall, false_positive_rate=fpr)
            assert math.isclose(sum(r[k] for k in ('true_positive','false_positive','true_negative','false_negative')), 10000)
for n, expected in ((25,(-.568,2.568)), (100,(.216,1.784))):
    actual = module.known_sigma_interval(1,4,n)
    assert all(math.isclose(a,b) for a,b in zip(actual,expected))
for operation in (lambda:module.alert_counts(base_rate=float('nan')), lambda:module.alert_counts(recall=True),
                  lambda:module.alert_counts(total=0),lambda:module.alert_counts(false_positive_rate=1.1),
                  lambda:module.known_sigma_interval(1,0,25),lambda:module.known_sigma_interval(1,4,2.5)):
    try:
        operation()
    except ValueError:
        pass
    else:
        raise AssertionError('Expected explicit invalid-input failure')
before = sorted(p.name for p in starter.iterdir())
result = subprocess.run([sys.executable, str(starter/'statistics_lab.py')],cwd=root,capture_output=True,text=True,check=True)
readme = (starter/'README.md').read_text(encoding='utf-8')
assert result.stdout.strip() in readme
assert sorted(p.name for p in starter.iterdir()) == before
content = (root/'src/content/chapter-07.mdx').read_text(encoding='utf-8')
stdout = io.StringIO()
with contextlib.redirect_stdout(stdout):
    for index,block in enumerate(re.findall(r'```python\n(.*?)\n```',content,re.S)):
        exec(compile(block,f'chapter07-block-{index}','exec'),{})
assert stdout.getvalue() == '4 3\n5.5\n2.345\n'
archive = root/'public/downloads/chapter-07-statistics-workbook.zip'
with ZipFile(archive,'w',ZIP_DEFLATED) as bundle:
    for name in ('statistics_lab.py','README.md'):
        bundle.write(starter/name,arcname=name)
with ZipFile(archive) as bundle:
    assert bundle.testzip() is None and sorted(bundle.namelist()) == ['README.md','statistics_lab.py']
    for name in bundle.namelist():
        assert bundle.read(name) == (starter/name).read_bytes()
out = root/'tmp/qa/chapter-07';out.mkdir(parents=True,exist_ok=True)
report = {'passed':True,'python':sys.version.split()[0],'checks':['Bayes examples and boundary cases','count conservation','known-SD intervals','invalid inputs','actual CLI output agrees with README','no generated workbook files','all Python snippets','verified workbook ZIP']}
(out/'python-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report))
