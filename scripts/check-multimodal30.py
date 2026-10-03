import importlib.util
import itertools
import json
import math
from pathlib import Path
import subprocess
import sys
import zipfile
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parent.parent
BOOK=ROOT/'public/downloads/chapter-30-multimodal'
spec=importlib.util.spec_from_file_location('multimodal30',BOOK/'multimodal.py')
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
subprocess.run([sys.executable,'-B','-m','unittest','-v','test_multimodal.py'],cwd=BOOK,check=True)
matches=list(itertools.product(['calm','chase','space'],['aligned','mismatched'],[.1,.5,1],['all','earth','moon']))
videos=list(itertools.product([1,2,4,5],[0,.25,.5,.75],[224,448],[False,True]))
program='import {match,sampleVideo} from "./src/lib/multimodal.mjs";console.log(JSON.stringify({matching:'+json.dumps(matches)+'.map(a=>match(...a)),video:'+json.dumps(videos)+'.map(a=>sampleVideo(...a))}));'
run=subprocess.run(['node','--input-type=module'],input=program,cwd=ROOT,encoding='utf-8',capture_output=True,check=True)
actual=json.loads(run.stdout)
def compare(a,b):
    if isinstance(b,dict):
        assert a.keys()==b.keys()
        for key in b:compare(a[key],b[key])
    elif isinstance(b,list):
        assert len(a)==len(b)
        for x,y in zip(a,b):compare(x,y)
    elif isinstance(b,bool):assert a is b
    elif isinstance(b,(int,float)):assert math.isclose(a,b,rel_tol=1e-11,abs_tol=1e-12),(a,b)
    else:assert a==b
for args,row in zip(matches,actual['matching']):compare(module.match(*args),row)
for args,row in zip(videos,actual['video']):compare(module.sample_video(*args),row)
cases=[([],dict(matching=module.match(),video=module.sample_video())),(['--query','space','--candidates','moon'],dict(matching=module.match('space',candidates='moon'),video=module.sample_video())),(['--interval','4','--phase','0.25','--resolution','448','--no-align-audio'],dict(matching=module.match(),video=module.sample_video(4,.25,448,False))),(['--space','mismatched','--temperature','0.1'],dict(matching=module.match(space='mismatched',temperature=.1),video=module.sample_video()))]
for args,expected in cases:compare(json.loads(subprocess.check_output([sys.executable,'-B','multimodal.py',*args],cwd=BOOK,encoding='utf-8')),expected)
invalid=[['--query','other'],['--space','other'],['--temperature','0'],['--candidates','none'],['--interval','3'],['--phase','1'],['--resolution','100'],['--align-audio','yes']]
for args in invalid:assert subprocess.run([sys.executable,'-B','multimodal.py',*args],cwd=BOOK,capture_output=True).returncode==2
files=['data.json','multimodal.py','test_multimodal.py','README.md']
with zipfile.ZipFile(BOOK.with_suffix('.zip'),'w',zipfile.ZIP_DEFLATED) as z:
    for name in files:z.write(BOOK/name,name)
with zipfile.ZipFile(BOOK.with_suffix('.zip')) as z:
    assert sorted(z.namelist())==sorted(files)
    for name in files:assert z.read(name)==(BOOK/name).read_bytes()
print(json.dumps(dict(passed=True,matching_reports=len(matches),video_reports=len(videos),cli_checks=len(cases)+len(invalid),zip_files=4)))
