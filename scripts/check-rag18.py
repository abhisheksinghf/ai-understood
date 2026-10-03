from pathlib import Path
import importlib.util
import json
import math
import subprocess
import sys
import zipfile

root=Path(__file__).resolve().parent.parent
work=root/'public/downloads/chapter-18-rag'
subprocess.run([sys.executable,'-m','unittest','-v','test_rag.py'],cwd=work,check=True)
spec=importlib.util.spec_from_file_location('rag',work/'rag.py');rag=importlib.util.module_from_spec(spec);spec.loader.exec_module(rag)
data=json.loads((work/'sources.json').read_text(encoding='utf-8-sig'))
script="""import {experiment} from './src/lib/rag-pipeline.mjs';const rows=[];for(const q of ['plot','runtime','streaming','space'])for(const c of ['card','section'])for(const k of [1,3,5])for(const b of [0,20,50,120])for(const l of ['all','under120'])for(const f of ['none','bad_id','bad_quote'])rows.push(experiment(q,c,k,b,l,f));console.log(JSON.stringify(rows));"""
rows=json.loads(subprocess.check_output(['node','--input-type=module','-e',script],cwd=root,text=True,encoding='utf-8'))
def equal(a,b,path=''):
    if isinstance(b,float):
        assert isinstance(a,(float,int)) and math.isclose(a,b,rel_tol=1e-12,abs_tol=1e-12),(path,a,b)
    elif isinstance(b,dict):
        assert a.keys()==b.keys(),path
        for k in b:equal(a[k],b[k],path+'/'+k)
    elif isinstance(b,list):
        assert len(a)==len(b),path
        for i,(x,y) in enumerate(zip(a,b)):equal(x,y,path+'/'+str(i))
    else:assert a==b,(path,a,b)
for row in rows:
    cfg=row['configuration'];equal(row,rag.experiment(data,**cfg))
for args in (['--k','0'],['--budget','-1'],['--input','missing.json'],['--ollama-model','test','--fault','bad_id']):
    result=subprocess.run([sys.executable,'rag.py',*args],cwd=work,text=True,capture_output=True,encoding='utf-8')
    assert result.returncode==2,(args,result.stdout,result.stderr)
    assert json.loads(result.stdout)['status']=='invalid_input'
files=['sources.json','rag.py','test_rag.py','README.md']
archive=root/'public/downloads/chapter-18-rag.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for name in files:z.write(work/name,name)
with zipfile.ZipFile(archive) as z:
    assert sorted(z.namelist())==sorted(files)
    for name in files:assert z.read(name)==(work/name).read_bytes()
print(json.dumps({'python_tests':6,'parity_cases':len(rows),'cli_errors':'passed','zip_files':files}))
