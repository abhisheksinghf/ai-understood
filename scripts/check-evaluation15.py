from pathlib import Path
import json
import math
import subprocess
import sys
import tempfile
import zipfile

root=Path(__file__).resolve().parent.parent
project=root/'public/downloads/chapter-15-model-evaluation'
sys.path.insert(0,str(project))
import evaluate as e

subprocess.run([sys.executable,'-m','unittest','-v','test_evaluate.py'],cwd=project,check=True)
data=json.loads((project/'movie_predictions.json').read_text(encoding='utf-8'))
expected=[e.experiment(data,c,t,s,cost) for c in ('a','b','baseline') for t in (0,.5,1) for s in ('all','short','long') for cost in e.COSTS]+[e.experiment(data,cost=cost,evaluate_test=True) for cost in e.COSTS]
js="import {dataset,experiment,COSTS} from './src/lib/model-evaluation.mjs'; const out=[]; for(const c of ['a','b','baseline'])for(const t of [0,.5,1])for(const s of ['all','short','long'])for(const cost of Object.keys(COSTS))out.push(experiment(c,t,s,cost)); for(const cost of Object.keys(COSTS))out.push(experiment('a',.5,'all',cost,dataset,true)); console.log(JSON.stringify(out));"
actual=json.loads(subprocess.check_output(['node','--input-type=module','-e',js],cwd=root,text=True,encoding='utf-8'))


def equal(a,b):
    if isinstance(a,dict):
        assert a.keys()==b.keys()
        for k in a: equal(a[k],b[k])
    elif isinstance(a,list):
        assert len(a)==len(b)
        for x,y in zip(a,b): equal(x,y)
    elif type(a) in (int,float):
        assert math.isclose(a,b,rel_tol=1e-10,abs_tol=1e-10),(a,b)
    else:
        assert a==b,(a,b)


equal(actual,expected)
with tempfile.TemporaryDirectory() as directory:
    folder=Path(directory)
    def run(*args,code=0):
        before={p.name:p.read_bytes() for p in folder.iterdir() if p.is_file()}
        p=subprocess.run([sys.executable,str(project/'evaluate.py'),*args],cwd=folder,capture_output=True,text=True,encoding='utf-8')
        assert p.returncode==code,p.stdout+p.stderr
        assert {p.name:p.read_bytes() for p in folder.iterdir() if p.is_file()}==before
        return json.loads(p.stdout)
    equal(run(),e.experiment(data))
    equal(run('--candidate','baseline','--threshold','1','--slice','short','--evaluate-test'),e.experiment(data,'baseline',1,'short',evaluate_test=True))
    equal(run('--cost','unwanted','--evaluate-test'),e.experiment(data,cost='unwanted',evaluate_test=True))
    for args in [('--threshold','nan'),('--threshold','1.1'),('--input',str(folder/'missing.json'))]:
        assert run(*args,code=2)['status']=='invalid_input'
    bad=folder/'bad.json'
    for contents in ('{"rows":','{"version":"bad","training_summary":{},"rows":[]}'):
        bad.write_text(contents,encoding='utf-8')
        assert run('--input',str(bad),code=2)['status']=='invalid_input'

files=sorted(p for p in project.iterdir() if p.is_file() and p.suffix in ('.py','.json','.md'))
assert len(files)==4
archive=root/'public/downloads/chapter-15-model-evaluation.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for file in files: z.write(file,file.name)
with zipfile.ZipFile(archive) as z:
    assert set(z.namelist())=={p.name for p in files}
    for file in files: assert z.read(file.name)==file.read_bytes()
print(json.dumps({'passed':True,'unitTests':9,'parityCases':len(expected),'archiveFiles':4,'checks':['independent counts and pairwise AUC','threshold invariants','ties and undefined metrics','test isolation','CLI and ZIP']}))
