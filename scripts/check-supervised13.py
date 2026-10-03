from pathlib import Path
import json
import math
import subprocess
import sys
import tempfile
import zipfile

root = Path(__file__).resolve().parent.parent
project = root/'public/downloads/chapter-13-supervised-learning'
sys.path.insert(0,str(project))
import supervised as s

subprocess.run([sys.executable,'-m','unittest','-v','test_supervised.py'],cwd=project,check=True)
data = json.loads((project/'movie_learning.json').read_text(encoding='utf-8'))
expected = [s.experiment(data,task,strength,.75,t,True) for task in ('regression','classification') for strength in s.STRENGTHS for t in (.5,.9)]
js = "import {dataset,experiment} from './src/lib/supervised-learning.mjs'; console.log(JSON.stringify(['regression','classification'].flatMap(task=>[0,.1,1].flatMap(s=>[.5,.9].map(t=>experiment(task,s,.75,t,dataset,true))))));"
actual = json.loads(subprocess.check_output(['node','--input-type=module','-e',js],cwd=root,text=True,encoding='utf-8'))


def equal(a,b):
    if isinstance(a,dict):
        assert a.keys()==b.keys()
        for k in a:
            equal(a[k],b[k])
    elif isinstance(a,list):
        assert len(a)==len(b)
        for x,y in zip(a,b):
            equal(x,y)
    elif type(a) in (int,float):
        assert math.isclose(a,b,rel_tol=1e-10,abs_tol=1e-10),(a,b)
    else:
        assert a==b,(a,b)


equal(actual,expected)
with tempfile.TemporaryDirectory() as directory:
    folder=Path(directory)

    def run(*args,code=0):
        before=set(folder.iterdir())
        p=subprocess.run([sys.executable,str(project/'supervised.py'),*args],cwd=folder,capture_output=True,text=True,encoding='utf-8')
        assert p.returncode==code,p.stdout+p.stderr
        assert set(folder.iterdir())==before
        return json.loads(p.stdout)

    equal(run(),s.experiment(data))
    equal(run('--task','classification','--threshold','.9'),s.experiment(data,'classification',threshold=.9))
    equal(run('--task','classification','--strength','1','--evaluate-test'),s.experiment(data,'classification',strength=1,evaluate_test=True))
    for args in [('--history','nan'),('--threshold','1.1'),('--input',str(folder/'missing.json'))]:
        assert run(*args,code=2)['status']=='invalid_input'
    file=folder/'bad.json'
    file.write_text('{"rows":',encoding='utf-8')
    assert run('--input',str(file),code=2)['status']=='invalid_input'

files=sorted(p for p in project.iterdir() if p.is_file() and p.suffix in ('.py','.json','.md'))
assert len(files)==4
archive=root/'public/downloads/chapter-13-supervised-learning.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for file in files:
        z.write(file,file.name)
with zipfile.ZipFile(archive) as z:
    assert set(z.namelist())=={p.name for p in files}
    for file in files:
        assert z.read(file.name)==file.read_bytes()
print(json.dumps({'passed':True,'unitTests':9,'parityCases':12,'archiveFiles':4,'checks':['independent regression solution','stable loss','gradient finite differences','threshold invariance','held-out isolation','CLI and ZIP']}))
