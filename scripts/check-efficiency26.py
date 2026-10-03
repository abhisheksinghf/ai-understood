"""Check numerical invariants, all preset reports, CLI errors, and workbook ZIP."""
import importlib.util
import itertools
import json
import math
from pathlib import Path
import subprocess
import sys
import zipfile
sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent.parent
BOOK = ROOT/'public/downloads/chapter-26-efficiency'
spec = importlib.util.spec_from_file_location('efficiency26', BOOK/'efficiency.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
subprocess.run([sys.executable,'-B','-m','unittest','-v','test_efficiency.py'],cwd=BOOK,check=True)
mem = list(itertools.product([4,8,16],[1,8,32],[8,16],[1,4,8],[1024,4096,8192],[8,16,24]))
quant = list(itertools.product(['balanced','outlier'],[4,8],['tensor','pairs']))
program = 'import {memory,compression} from "./src/lib/llm-efficiency.mjs"; console.log(JSON.stringify({memory:'+json.dumps(mem)+'.map(a=>memory(...a)),compression:'+json.dumps(quant)+'.map(a=>compression(...a))}));'
actual = json.loads(subprocess.check_output(['node','--input-type=module','-e',program],cwd=ROOT,encoding='utf-8'))


def compare(a,b):
    if isinstance(b,dict):
        assert a.keys()==b.keys()
        for key in b: compare(a[key],b[key])
    elif isinstance(b,list):
        assert len(a)==len(b)
        for x,y in zip(a,b): compare(x,y)
    elif isinstance(b,bool): assert a is b
    elif isinstance(b,(int,float)): assert math.isclose(a,b,rel_tol=1e-12,abs_tol=1e-12), (a,b)
    else: assert a==b


for args,result in zip(mem,actual['memory']): compare(module.memory(*args),result)
for args,result in zip(quant,actual['compression']): compare(module.compression(*args),result)
cli = json.loads(subprocess.check_output([sys.executable,'-B','efficiency.py'],cwd=BOOK,encoding='utf-8'))
compare(cli,dict(memory=module.memory(),compression=module.compression()))
for args in [['--weight-bits','3'],['--kv-heads','4'],['--tokens','0'],['--preset','unknown'],['--grouping','missing'],['--quant-bits','16']]:
    result=subprocess.run([sys.executable,'-B','efficiency.py',*args],cwd=BOOK,capture_output=True)
    assert result.returncode==2
files=['data.json','efficiency.py','test_efficiency.py','README.md']
archive=BOOK.with_suffix('.zip')
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for name in files: z.write(BOOK/name,name)
with zipfile.ZipFile(archive) as z:
    assert sorted(z.namelist())==sorted(files)
    for name in files: assert z.read(name)==(BOOK/name).read_bytes()
print(json.dumps(dict(memory_reports=len(mem),quantization_reports=len(quant),cli_checks=7,zip_files=len(files),passed=True)))
