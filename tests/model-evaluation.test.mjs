import test from 'node:test';
import assert from 'node:assert/strict';
import {dataset,experiment,evaluateRows,validateDataset} from '../src/lib/model-evaluation.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
test('evaluation agrees with independently calculated confusion metrics',()=>{
  const r=experiment().validation;assert.deepEqual(r.confusion,{tp:3,fp:2,tn:7,fn:0});near(r.accuracy,10/12);near(r.precision,.6);near(r.recall,1);near(r.f1,.75);near(r.auc,25/27);near(r.brier,.14375);assert.equal(r.total_cost,2);
});
test('raising thresholds shrinks the positive set without changing score metrics',()=>{
  for(const candidate of ['a','b','baseline']){let prior;for(let i=0;i<=20;i++){const r=experiment(candidate,i/20).validation;if(prior){assert.ok(r.confusion.tp<=prior.confusion.tp);assert.ok(r.confusion.fp<=prior.confusion.fp);for(const metric of ['auc','log_loss','brier'])assert.equal(r[metric],prior[metric]);}prior=r;}}
  assert.equal(experiment('baseline',.25).validation.confusion.fp,9);
});
test('undefined cases and tied-score ROC have explicit semantics',()=>{
  const b=experiment('baseline').validation;assert.equal(b.precision,null);assert.equal(b.recall,0);assert.equal(b.f1,0);assert.equal(b.auc,.5);
  const rows=structuredClone(dataset.rows.slice(0,6));rows.forEach((r,i)=>{r.liked=i%2;r.a=[.2,.2,.8,.8,.5,.5][i];});
  const r=evaluateRows(rows);near(r.auc,.5);assert.deepEqual(r.roc,evaluateRows([...rows].reverse()).roc);
  rows.forEach(r=>{r.liked=0;r.a=0;});const empty=evaluateRows(rows);for(const key of ['precision','recall','f1','auc','roc','balanced_accuracy'])assert.equal(empty[key],null);
});
test('cost-sensitive selection uses validation while exploratory controls are separate',()=>{
  for(const [cost,candidate,threshold] of [['misses','a',.6],['unwanted','b',.7],['equal','a',.6]]){const r=experiment('a',.5,'all',cost);assert.equal(r.selection.winner.candidate,candidate);assert.equal(r.selection.winner.threshold,threshold);assert.equal(r.selection.winner.total_cost,1);}
  const a=experiment('a',.5,'all','misses',dataset,true),b=experiment('baseline',1,'short','misses',dataset,true);assert.deepEqual(a.final_test,b.final_test);assert.equal(experiment().final_test,undefined);
});
test('test edits cannot change validation, the baseline, or the selected policy',()=>{
  const original=structuredClone(dataset),changed=structuredClone(dataset);changed.rows.filter(r=>r.split==='test').forEach(r=>{r.liked=1-r.liked;r.a=1-r.a;});
  assert.deepEqual(experiment(),experiment('a',.5,'all','misses',changed));assert.notDeepEqual(experiment('a',.5,'all','misses',dataset,true).final_test,experiment('a',.5,'all','misses',changed,true).final_test);assert.deepEqual(dataset,original);
  for(const slice of ['short','long'])assert.deepEqual(experiment('a',.5,slice).selection,experiment().selection);
});
test('malformed and leaking snapshots fail rather than silently altering metrics',()=>{
  for(const value of [null,true,'0.5',NaN,Infinity,-.1,1.1]){const bad=structuredClone(dataset);bad.rows[0].a=value;assert.throws(()=>validateDataset(bad));}
  const bad=structuredClone(dataset);bad.rows.at(-1).viewer_id='V001';assert.throws(()=>validateDataset(bad));assert.throws(()=>experiment('a',NaN));
});
