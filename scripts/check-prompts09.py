"""Check shared cases, cross-language prompts, CLI behavior, and the learner archive."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
from zipfile import ZipFile, ZIP_DEFLATED

sys.dont_write_bytecode=True
root=Path(__file__).resolve().parent.parent
starter=root/'public/downloads/chapter-09-prompting'
out=root/'tmp/qa/chapter-09';out.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('prompts09',starter/'prompt_lab.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
code="import {promptCases,promptVersions,buildPrompt} from './src/lib/prompt-workshop.mjs'; console.log(JSON.stringify(promptCases.flatMap(c=>promptVersions.map(v=>({id:c.id,version:v.id,text:buildPrompt(c.id,v.id)})))));"
result=subprocess.run(['node','--input-type=module','-e',code],cwd=root,capture_output=True,text=True,check=True)
prompts=json.loads(result.stdout)
assert len(prompts)==12
for row in prompts:
    assert row['text']==module.build_prompt(row['id'],row['version'])
for item in module.CASES:
    ids=[source['id'] for source in item['sources']]
    assert module.validate_recommendation(item['reference'],ids)==[]
    wrong_type={**item['reference'],'streaming_service':42}
    assert module.validate_recommendation(wrong_type,ids)
    assert module.validate_recommendation({**item['reference'],'evidence_ids':['S99']},ids)
    assert module.validate_recommendation({**item['reference'],'evidence_ids':[['S1']]},ids)
    assert module.validate_recommendation({**item['reference'],'streaming_service':'ExampleFlix [S1]'},ids)==[]
for case_id,version in [('unknown','grounded'),('incomplete','unknown')]:
    try:module.build_prompt(case_id,version)
    except ValueError:pass
    else:raise AssertionError('Expected unknown-selection rejection')
before=sorted(p.name for p in starter.iterdir())
def cli(*args):
    return subprocess.run([sys.executable,str(starter/'prompt_lab.py'),*args],cwd=root,capture_output=True,text=True)
demo=cli('--demo');assert demo.returncode==0
assert demo.stdout.strip() in (starter/'README.md').read_text(encoding='utf-8')
assembled=cli('--case','incomplete','--version','grounded');assert assembled.returncode==0
assert assembled.stdout.startswith(module.build_prompt('incomplete','grounded'))
assert 'HUMAN-WRITTEN REFERENCE; NOT A MODEL RESPONSE' in assembled.stdout
candidate=out/'candidate.json'
candidate.write_text(json.dumps(module.CASES[0]['reference']),encoding='utf-8');assert cli('--check',str(candidate)).returncode==0
candidate.write_text('{"recommendation": 42}',encoding='utf-8');assert cli('--check',str(candidate)).returncode==1
candidate.write_text('{invalid',encoding='utf-8');assert cli('--check',str(candidate)).returncode==2
assert cli('--check',str(out/'missing-report.json')).returncode==2
assert sorted(p.name for p in starter.iterdir())==before
archive=root/'public/downloads/chapter-09-prompting-workbook.zip'
with ZipFile(archive,'w',ZIP_DEFLATED) as bundle:
    for name in ('prompt_lab.py','cases.json','README.md'):bundle.write(starter/name,arcname=name)
with ZipFile(archive) as bundle:
    assert bundle.testzip() is None and sorted(bundle.namelist())==['README.md','cases.json','prompt_lab.py']
    for name in bundle.namelist():assert bundle.read(name)==(starter/name).read_bytes()
report={'passed':True,'python':sys.version.split()[0],'checks':['all 12 prompts match JavaScript byte for byte','shared source cases and reference structure','known IDs and malformed fields','unsupported-claim limitation','CLI prompt and demo output','JSON file validation and exit codes','verified workbook ZIP','no files created in learner folder']}
(out/'python-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report))
