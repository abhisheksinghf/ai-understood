import test from 'node:test';
import assert from 'node:assert/strict';
import {rawRows,splitPlan,cleanRows,prepareData,fitPreprocessor} from '../src/lib/data-preparation.mjs';
test('data audit and default numeric preparation match independent calculations',()=>{
  const r=prepareData();assert.equal(r.audit.raw_rows,13);assert.equal(r.audit.kept_rows,10);assert.equal(r.audit.duplicate_rows,1);assert.equal(r.audit.quarantined.length,1);assert.equal(r.audit.unlabeled.length,1);
  assert.equal(r.state.fill_value,110);assert.ok(Math.abs(r.state.runtime_mean-670/6)<1e-12);assert.ok(Math.abs(r.prepared.train.X[3][0]+0.1118033988749898)<1e-12);
  assert.equal(prepareData('mean').state.fill_value,112.5);assert.equal(prepareData('median','all').state.fill_value,127.5);
});
test('held-out edits cannot affect training-only fit or training features',()=>{
  const edited=structuredClone(rawRows);for(const row of edited)if(['U04','U05'].includes(row.viewer_id)){row.runtime_minutes='500';row.genre='fantasy';}
  const a=prepareData(),b=prepareData('median','train',edited);assert.deepEqual(a.state,b.state);assert.deepEqual(a.prepared.train,b.prepared.train);assert.notDeepEqual(prepareData('median','all').state,prepareData('median','all',edited).state);
});
test('split groups, one-hot layout, and missing flags preserve their meaning',()=>{
  const r=prepareData();assert.deepEqual(Object.values(r.prepared).map(p=>p.X.length),[6,2,2]);assert.equal(r.state.feature_names.length,8);
  const sets=Object.values(r.prepared).map(p=>new Set(p.viewer_ids));assert.ok([...sets[0]].every(x=>!sets[1].has(x)&&!sets[2].has(x)));assert.ok([...sets[1]].every(x=>!sets[2].has(x)));
  for(const part of Object.values(r.prepared))for(const x of part.X){assert.equal(x.length,8);assert.equal(x.slice(2).reduce((a,b)=>a+b,0),1);assert.ok(x.every(Number.isFinite));}
  assert.equal(r.prepared.validation.X[0].at(-1),1);assert.equal(r.prepared.train.X[3][1],1);assert.equal(r.splits.train[3].runtime_minutes,null);
});
test('conflicting IDs, unknown groups, and degenerate fitting require explicit handling',()=>{
  const rows=structuredClone(rawRows.slice(0,10));rows.push({...rows[0],liked:'0'});const cleaned=cleanRows(rows);assert.equal(cleaned.rows.length,9);assert.equal(cleaned.audit.quarantined.length,2);
  const plan=structuredClone(splitPlan);plan.test.push('U01');assert.throws(()=>prepareData('median','train',rawRows,plan));
  const train=structuredClone(prepareData().splits.train);train.forEach(r=>r.runtime_minutes=null);assert.throws(()=>fitPreprocessor(train));train.forEach(r=>r.runtime_minutes=105);assert.equal(fitPreprocessor(train).runtime_scale,1);
});
test('future reviews and labels never enter feature fitting or transformation',()=>{
  const edited=structuredClone(rawRows);edited.forEach(r=>{if(r.liked)r.liked=String(1-Number(r.liked));r.review_after='A changed future review';});
  const a=prepareData(),b=prepareData('median','train',edited);assert.deepEqual(a.state,b.state);for(const role of ['train','validation','test'])assert.deepEqual(a.prepared[role].X,b.prepared[role].X);
});
