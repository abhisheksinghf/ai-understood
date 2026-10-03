from pathlib import Path
import json
import math
import subprocess
import sys
import tempfile
import zipfile

root=Path(__file__).resolve().parent.parent
project=root/'public/downloads/chapter-14-unsupervised-learning'
sys.path.insert(0,str(project))
import unsupervised as u

subprocess.run([sys.executable,'-m','unittest','-v','test_unsupervised.py'],cwd=project,check=True)
data=json.loads((project/'movie_features.json').read_text(encoding='utf-8'))
expected=[u.experiment(data,'clusters',k,start,weight,steps) for k in (2,3) for start in ('spread','first') for weight in (1,3) for steps in (0,1,50)]+[u.experiment(data,'pca')]
js="import {experiment} from './src/lib/unsupervised-learning.mjs'; const out=[]; for(const k of [2,3])for(const s of ['spread','first'])for(const w of [1,3])for(const n of [0,1,50])out.push(experiment('clusters',k,s,w,n)); out.push(experiment('pca')); console.log(JSON.stringify(out));"
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
        p=subprocess.run([sys.executable,str(project/'unsupervised.py'),*args],cwd=folder,capture_output=True,text=True,encoding='utf-8')
        assert p.returncode==code,p.stdout+p.stderr
        assert {p.name:p.read_bytes() for p in folder.iterdir() if p.is_file()}==before
        return json.loads(p.stdout)
    equal(run(),u.experiment(data))
    equal(run('--mode','pca'),u.experiment(data,'pca'))
    equal(run('--k','3','--start','first','--humor-weight','3','--steps','1'),u.experiment(data,'clusters',3,'first',3,1))
    for args in [('--steps','-1'),('--steps','51'),('--input',str(folder/'missing.json'))]:
        assert run(*args,code=2)['status']=='invalid_input'
    bad=folder/'bad.json'
    for contents in ('{"movies":', '{"version":"movie-structure-v1","movies":[]}'):
        bad.write_text(contents,encoding='utf-8')
        assert run('--input',str(bad),code=2)['status']=='invalid_input'
    edited=json.loads(json.dumps(data));edited['movies'][0]['action']=float('nan')
    bad.write_text(json.dumps(edited),encoding='utf-8')
    assert run('--input',str(bad),code=2)['status']=='invalid_input'

files=sorted(p for p in project.iterdir() if p.is_file() and p.suffix in ('.py','.json','.md'))
assert len(files)==4
archive=root/'public/downloads/chapter-14-unsupervised-learning.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for file in files: z.write(file,file.name)
with zipfile.ZipFile(archive) as z:
    assert set(z.namelist())=={p.name for p in files}
    for file in files: assert z.read(file.name)==file.read_bytes()
print(json.dumps({'passed':True,'unitTests':9,'parityCases':25,'archiveFiles':4,'checks':['hand calculations','monotonic k-means','degenerate inputs','PCA invariants','CLI and ZIP']}))
