from pathlib import Path
import json
import math
import subprocess
import sys
import tempfile
import zipfile

root=Path(__file__).resolve().parent.parent
project=root/'public/downloads/chapter-16-search'
sys.path.insert(0,str(project))
from search import search
data=json.loads((project/'movies.json').read_text(encoding='utf-8'))
subprocess.run([sys.executable,'-m','unittest','-v','test_search.py'],cwd=project,check=True)
cases=[[q,m,mode,limit,k,1.2,.75] for q in ['space rescue','funny adventure','quiet drama','hilarious quest','','space unknownword','a'] for m in ['overlap','tfidf','bm25'] for mode in ['any','all'] for limit in ['all','under120'] for k in [1,3,5]]
cases += [['space rescue','bm25','any','all',3,k1,b] for k1 in [0,.2,3] for b in [0,.5,1]]
expected=[search(data,*c) for c in cases]
js="import {search} from './src/lib/information-retrieval.mjs'; console.log(JSON.stringify("+json.dumps(cases)+".map(c=>search(...c))));"
actual=json.loads(subprocess.check_output(['node','--input-type=module','-e',js],cwd=root,text=True,encoding='utf-8'))
def equal(a,b):
    if isinstance(a,dict):
        assert a.keys()==b.keys()
        for key in a: equal(a[key],b[key])
    elif isinstance(a,list):
        assert len(a)==len(b)
        for x,y in zip(a,b): equal(x,y)
    elif type(a) in (int,float):
        assert math.isclose(a,b,rel_tol=1e-10,abs_tol=1e-10),(a,b)
    else: assert a==b,(a,b)
equal(actual,expected)
with tempfile.TemporaryDirectory() as directory:
    folder=Path(directory)
    def run(*args,code=0):
        before={p.name:p.read_bytes() for p in folder.iterdir()}
        p=subprocess.run([sys.executable,str(project/'search.py'),*args],cwd=folder,capture_output=True,text=True,encoding='utf-8')
        assert p.returncode==code,p.stdout+p.stderr
        assert {p.name:p.read_bytes() for p in folder.iterdir()}==before
        return json.loads(p.stdout)
    equal(run(),search(data))
    equal(run('--mode','all','--limit','under120','--k','5'),search(data,mode='all',limit='under120',k=5))
    for args in [('--k','0'),('--k1','nan'),('--b','2'),('--input',str(folder/'missing.json'))]:
        assert run(*args,code=2)['status']=='invalid_input'
    invalid=folder/'invalid.json'
    for text in ['{','null','{"version":"wrong"}']:
        invalid.write_text(text,encoding='utf-8')
        assert run('--input',str(invalid),code=2)['status']=='invalid_input'
files=sorted(p for p in project.iterdir() if p.is_file() and p.suffix in ('.py','.json','.md'))
assert len(files)==4
archive=root/'public/downloads/chapter-16-search.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for file in files:z.write(file,file.name)
with zipfile.ZipFile(archive) as z:
    assert set(z.namelist())=={p.name for p in files}
    for file in files:assert z.read(file.name)==file.read_bytes()
print(json.dumps({'passed':True,'pythonTests':8,'parityCases':len(cases),'archiveFiles':4}))
