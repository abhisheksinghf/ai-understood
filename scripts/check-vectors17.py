from pathlib import Path
import json
import math
import subprocess
import sys
import tempfile
import zipfile

root=Path(__file__).resolve().parent.parent
project=root/'public/downloads/chapter-17-vector-search'
sys.path.insert(0,str(project))
from vector_search import experiment
data=json.loads((project/'vectors.json').read_text(encoding='utf-8'))
subprocess.run([sys.executable,'-m','unittest','-v','test_vector_search.py'],cwd=project,check=True)
cases=[[q,m,n,mode,f,k] for q in ['space','funny','quiet'] for m in ['cosine','dot','euclidean'] for n in ['raw','unit'] for mode in (['exact','probe1','probe2','probe3'] if m=='cosine' else ['exact']) for f in ['all','under120'] for k in [1,3,5]]
expected=[experiment(data,*c) for c in cases]
js="import {experiment} from './src/lib/vector-search.mjs'; console.log(JSON.stringify("+json.dumps(cases)+".map(c=>experiment(...c))));"
actual=json.loads(subprocess.check_output(['node','--input-type=module','-e',js],cwd=root,text=True,encoding='utf-8'))
def equal(a,b):
    if isinstance(a,dict):
        assert a.keys()==b.keys()
        for key in a:equal(a[key],b[key])
    elif isinstance(a,list):
        assert len(a)==len(b)
        for x,y in zip(a,b):equal(x,y)
    elif type(a) in (int,float):assert math.isclose(a,b,rel_tol=1e-10,abs_tol=1e-10),(a,b)
    else:assert a==b,(a,b)
equal(actual,expected)
old=json.loads((root/'public/downloads/chapter-16-search/movies.json').read_text(encoding='utf-8'))
assert [{k:d[k] for k in ['id','title','runtime_minutes','summary']} for d in data['movies']]==old['movies']
assert [{k:q[k] for k in ['query','intent','relevant']} for q in data['queries']]==old['queries']
with tempfile.TemporaryDirectory() as directory:
    folder=Path(directory)
    def run(*args,code=0):
        before={p.name:p.read_bytes() for p in folder.iterdir()}
        p=subprocess.run([sys.executable,str(project/'vector_search.py'),*args],cwd=folder,capture_output=True,text=True,encoding='utf-8')
        assert p.returncode==code,p.stdout+p.stderr
        assert {p.name:p.read_bytes() for p in folder.iterdir()}==before
        return json.loads(p.stdout)
    equal(run(),experiment(data))
    equal(run('--mode','probe1','--limit','under120'),experiment(data,mode='probe1',limit='under120'))
    for args in [('--k','0'),('--mode','probe1','--metric','dot'),('--input',str(folder/'missing.json'))]:assert run(*args,code=2)['status']=='invalid_input'
    invalid=folder/'bad.json'
    for value in ['{','null','{"version":"bad"}']:
        invalid.write_text(value,encoding='utf-8');assert run('--input',str(invalid),code=2)['status']=='invalid_input'
files=sorted(p for p in project.iterdir() if p.is_file() and p.suffix in ('.py','.json','.md'));assert len(files)==4
archive=root/'public/downloads/chapter-17-vector-search.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for file in files:z.write(file,file.name)
with zipfile.ZipFile(archive) as z:
    assert set(z.namelist())=={p.name for p in files}
    for file in files:assert z.read(file.name)==file.read_bytes()
print(json.dumps({'passed':True,'pythonTests':6,'parityCases':len(cases),'archiveFiles':4,'catalogMatchesChapter16':True}))
