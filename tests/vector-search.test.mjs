import test from 'node:test';
import assert from 'node:assert/strict';
import {dataset,experiment,cosine,dot,distance,unit,validateSnapshot} from '../src/lib/vector-search.mjs';
const ids=r=>r.results.map(d=>d.id);
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
test('worked geometry and metric directions match independent arithmetic',()=>{
  close(cosine([1,0,0],[.9,.1,0]),.9/Math.sqrt(.82));close(distance([1,0,0],[.9,.1,0]),Math.sqrt(.02));
  assert.deepEqual(ids(experiment()),['M004','M008','M007']);
  assert.deepEqual(ids(experiment('space','dot')),['M002','M008','M004']);
  assert.deepEqual(ids(experiment('space','euclidean')),['M004','M007','M008']);
});
test('unit vectors make all three metrics equivalent and positive scaling preserves cosine',()=>{
  for(const q of ['space','funny','quiet']){
    const reference=experiment(q,'cosine','unit','exact','all',8);
    for(const metric of ['dot','euclidean']){
      const rows=experiment(q,metric,'unit','exact','all',8).results;
      for(const row of rows){const c=reference.results.find(d=>d.id===row.id).value;close(metric==='dot'?row.value:row.value**2,metric==='dot'?c:2-2*c);}
      const scores=rows.map(row=>reference.results.find(d=>d.id===row.id).value);
      assert.ok(scores.every((score,i)=>i===0||scores[i-1]+1e-12>=score),'Only numerically tied cosine neighbors may swap.');
    }
  }
  const a=unit([.2,.8,1]),b=unit([.6,.4,.1]);close(dot(a,b),cosine(a,b));close(distance(a,b)**2,2-2*dot(a,b));
  const changed=structuredClone(dataset);changed.movies.find(d=>d.id==='M007').vector=[8,2,0];
  assert.deepEqual(ids(experiment('space','cosine','raw','exact','all',8,changed)),ids(experiment('space','cosine','raw','exact','all',8)));
  assert.equal(experiment('space','dot','raw','exact','all',3,changed).results[0].id,'M007');
});
test('partial cell search misses a known neighbor, more cells recover it',()=>{
  const one=experiment('space','cosine','raw','probe1'),two=experiment('space','cosine','raw','probe2');
  assert.deepEqual(ids(one),['M004','M008']);assert.equal(one.index.searched_candidates,2);close(one.audit.neighbor_recall_at_k,2/3);
  assert.deepEqual(ids(two),ids(experiment()));assert.equal(two.index.searched_candidates,7);assert.equal(two.audit.neighbor_recall_at_k,1);
  for(const q of ['space','funny','quiet'])for(const limit of ['all','under120'])assert.deepEqual(experiment(q,'cosine','raw','probe3',limit,5).results,experiment(q,'cosine','raw','exact',limit,5).results);
});
test('neighbor recall and relevance recall keep distinct denominators',()=>{
  const r=experiment('space','cosine','raw','probe1','under120');
  assert.deepEqual(r.audit.exact_ids,['M004','M008','M003']);close(r.audit.neighbor_recall_at_k,2/3);assert.equal(r.evaluation.recall_at_k,1);close(r.evaluation.precision_at_k,2/3);
  const dotResult=experiment('space','dot');assert.equal(dotResult.audit.neighbor_recall_at_k,1);close(dotResult.evaluation.recall_at_k,2/3);
  const empty=structuredClone(dataset);empty.movies.forEach(d=>d.runtime_minutes=null);const no=experiment('space','cosine','raw','exact','under120',3,empty);assert.equal(no.audit.neighbor_recall_at_k,null);assert.equal(no.evaluation.recall_at_k,null);assert.deepEqual(no.results,[]);
});
test('judgments cannot change rankings; lexical baseline preserves Chapter 16 numbers',()=>{
  const changed=structuredClone(dataset);changed.queries[0].relevant=[];assert.deepEqual(experiment('space','cosine','raw','exact','all',3,changed).results,experiment().results);
  assert.deepEqual(experiment().lexical.results.map(d=>d.id),['M008','M004','M005']);close(experiment().lexical.results[0].score,2.1862975961787265);
  assert.equal(experiment('funny','cosine','raw','exact','all',1).evaluation.precision_at_k,0);assert.equal(experiment('funny','cosine','raw','exact','all',1).lexical.evaluation.precision_at_k,1);
});
test('space contracts reject mismatches, zero vectors, malformed values, and invalid modes',()=>{
  for(const vector of [[0,0,0],[1,2],[1,NaN,0],[1,Infinity,0]]){const d=structuredClone(dataset);d.movies[0].vector=vector;assert.throws(()=>validateSnapshot(d));}
  const mismatch=structuredClone(dataset);mismatch.queries[0].space_id='another-3d-model';assert.throws(()=>validateSnapshot(mismatch));
  const duplicate=structuredClone(dataset);duplicate.movies[1].id='M001';assert.throws(()=>validateSnapshot(duplicate));
  assert.throws(()=>experiment('unknown'));assert.throws(()=>experiment('space','dot','raw','probe1'));assert.throws(()=>experiment('space','cosine','raw','exact','all',0));
});
