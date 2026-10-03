import test from 'node:test';
import assert from 'node:assert/strict';
import {promptCases as cases,buildPrompt,validateRecommendation,promptVersions} from '../src/lib/prompt-workshop.mjs';
test('all prompt variants keep source content intact and reference answers are separate',()=>{
  for(const item of cases)for(const version of promptVersions){
    const prompt=buildPrompt(item.id,version.id);
    const payload=prompt.split('BEGIN SOURCE DATA (JSON)\n')[1].split('\nEND SOURCE DATA')[0];
    assert.deepEqual(JSON.parse(payload),item.sources);
    assert.ok(!prompt.includes(item.reference.recommendation));
    if(version.id==='grounded')assert.match(prompt,/A matching genre does not establish availability/);
  }
  assert.throws(()=>buildPrompt('unknown','grounded'));assert.throws(()=>buildPrompt('incomplete','unknown'));
});
test('validator checks structure and known source IDs while deliberately not claiming factual verification',()=>{
  for(const item of cases)assert.deepEqual(validateRecommendation(item.reference,item.sources.map(s=>s.id)),[]);
  const valid=structuredClone(cases[0].reference),ids=['S1','S2','S3'];
  assert.ok(validateRecommendation({...valid,evidence_ids:['S99']},ids).length);
  assert.ok(validateRecommendation({...valid,evidence_ids:['S1','S1']},ids).length);
  assert.ok(validateRecommendation({...valid,streaming_service:42},ids).length);
  assert.ok(validateRecommendation({...valid,extra:'unexpected'},ids).length);
  assert.ok(validateRecommendation(null,ids).length);
  const falseClaim={...valid,streaming_service:'ExampleFlix [S1]'};
  assert.deepEqual(validateRecommendation(falseClaim,ids),[],'A structurally valid unsupported claim must illustrate the semantic-check gap.');
});
