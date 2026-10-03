"""Validate chapter calculations, executable snippets, and the learner ZIP."""
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
root=Path(__file__).resolve().parent.parent
starter=root/'public/downloads/chapter-08-calculus'
spec=importlib.util.spec_from_file_location('calculus08',starter/'calculus_lab.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
for rate in (.1,.5,1,1.5,2,2.2):
    for start in (-2,0,3,6):
        for step,w,value in module.descent(start,rate,12):
            assert math.isclose(w,3+(start-3)*(1-rate)**step,abs_tol=1e-9)
            assert math.isclose(value,.5*(w-3)**2,abs_tol=1e-9)
assert module.descent(0,2,2)==[(0,0,4.5),(1,6,4.5),(2,0,4.5)]
for w in (-2,0,1.5,3,6):
    h=1e-5
    assert math.isclose(module.gradient(w),(module.loss(w+h)-module.loss(w-h))/(2*h),abs_tol=1e-8)
# Independent checks of the chain-rule example and the probability-loss derivative.
f=lambda w: .5*(2*w+1-5)**2
assert f(1)==2 and f(2)==0
assert math.isclose((f(1+1e-5)-f(1-1e-5))/2e-5,-4,abs_tol=1e-8)
binary_loss=lambda z: math.log1p(math.exp(-z))
z=math.log(4);h=1e-5
assert math.isclose((binary_loss(z+h)-binary_loss(z-h))/(2*h),-.2,abs_tol=1e-9)
assert math.isclose(binary_loss(z),-math.log(.8))
assert math.isclose(module.entropy([.75,.25]),.8112781244591328)
assert module.cross_entropy([.75,.25],[.5,.5])==1
assert module.entropy([.5,.5])==1 and module.entropy([1,0])==0
assert module.cross_entropy([1,0],[1,0])==0
assert math.isinf(module.cross_entropy([.75,.25],[1,0]))
for operation in (lambda:module.entropy([.4,.4]),lambda:module.entropy([float('nan'),1]),lambda:module.cross_entropy([1],[.5,.5]),lambda:module.descent(0,.5,13),lambda:module.descent(True,.5,1)):
    try:operation()
    except ValueError:pass
    else:raise AssertionError('Expected invalid-input failure')
before=sorted(p.name for p in starter.iterdir())
result=subprocess.run([sys.executable,str(starter/'calculus_lab.py')],cwd=root,capture_output=True,text=True,check=True)
assert result.stdout.strip() in (starter/'README.md').read_text(encoding='utf-8'),result.stdout
assert sorted(p.name for p in starter.iterdir())==before
content=(root/'src/content/chapter-08.mdx').read_text(encoding='utf-8')
stdout=io.StringIO()
with contextlib.redirect_stdout(stdout):
    for index,block in enumerate(re.findall(r'```python\n(.*?)\n```',content,re.S)):
        exec(compile(block,f'chapter08-block-{index}','exec'),{})
assert stdout.getvalue()=='1 1.5 1.125\n2 2.25 0.28125\n3 2.625 0.0703125\n'
archive=root/'public/downloads/chapter-08-calculus-workbook.zip'
with ZipFile(archive,'w',ZIP_DEFLATED) as bundle:
    for name in ('calculus_lab.py','README.md'):bundle.write(starter/name,arcname=name)
with ZipFile(archive) as bundle:
    assert bundle.testzip() is None and sorted(bundle.namelist())==['README.md','calculus_lab.py']
    for name in bundle.namelist():assert bundle.read(name)==(starter/name).read_bytes()
out=root/'tmp/qa/chapter-08';out.mkdir(parents=True,exist_ok=True)
report={'passed':True,'python':sys.version.split()[0],'checks':['closed-form descent across rates and starts','gradient and chain-rule finite differences','binary cross-entropy derivative','entropy and zero-probability boundaries','invalid inputs','CLI output agrees with README','all Python snippets','verified ZIP and no generated learner files']}
(out/'python-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report))
