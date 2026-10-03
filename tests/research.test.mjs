import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../public/downloads/chapter-41-research/data.json' with {type:'json'};
import {audit,wilson,uncertainty,ablate,evaluate,normalize,choices} from '../src/lib/research.mjs';
test('paired audit preserves both denominators and exposes sensitivity',()=>{
 const all=audit('all','keep'),filtered=audit('all','exclude');
 assert.deepEqual([all.baseline,all.candidate,all.n,all.difference,all.wins,all.losses,all.ties],[6,9,12,.25,4,1,7]);
 assert.deepEqual([filtered.baseline,filtered.candidate,filtered.n,filtered.difference,filtered.wins,filtered.losses,filtered.ties],[6,5,8,-.125,0,1,7]);
 assert.deepEqual(filtered.rows.filter(r=>!r.included).map(r=>r.id),['Q01','Q02','Q05','Q09']);
 assert.deepEqual(filtered.rows.map(({included,...r})=>r),data.cases);
});
test('slice denominators and empty selections remain explicit',()=>{
 assert.equal(audit('facts','exclude').difference,-.5);
 assert.equal(audit('preferences','exclude').difference,0);assert.equal(audit('tools','exclude').n,3);
 const empty=audit('facts','exclude',data.cases.map(r=>({...r,overlap:true})));
 assert.equal(empty.n,0);assert.equal(empty.difference,null);assert.equal(empty.baselineRate,null);
});
test('Wilson reference values and boundaries are valid',()=>{
 assert.deepEqual(wilson(20,25),{rate:.8,low:.608687,high:.911395,width:.302709});
 assert.deepEqual(wilson(0,0),{rate:null,low:null,high:null,width:null});
 assert.equal(wilson(0,10).low,0);assert.equal(wilson(10,10).high,1);
 for(const [k,n]of [[-1,10],[11,10],[1,0],[.5,1],[true,1]])assert.throws(()=>wilson(k,n));
});
test('hypothetical independent sample size changes precision, not point rate',()=>{
 const rows=uncertainty(100).rows;assert.deepEqual(rows.map(r=>r.rate),[.8,.8,.8]);
 assert.deepEqual(rows.map(r=>r.width),[.302709,.155465,.078235]);assert.equal(uncertainty(400).selected.high,.836264);
});
test('ablation removals and conditional interaction use the intended variants',()=>{
 assert.equal(ablate('matched','retrieval').ablated.id,'reranker');
 assert.equal(ablate('matched','reranker').contrast,.09);assert.equal(ablate('matched','both').contrast,.24);
 assert.equal(ablate('matched','retrieval').contrast,.19);assert.equal(ablate('matched','both').interaction,.04);
});
test('unequal budgets are flagged and cannot isolate an interaction',()=>{
 const a=ablate('unequal','retrieval');assert.equal(a.matched,false);assert.equal(a.contrast,.25);assert.equal(a.interaction,null);assert.equal(a.full.budget,3000);
 assert.deepEqual(a.rows.filter(r=>r.id!=='full').map(({selected,...r})=>r),ablate('matched','retrieval').rows.filter(r=>r.id!=='full').map(({selected,...r})=>r));
 assert.equal(data.ablations.find(r=>r.id==='full').passed,84);
});
test('all 144 configurations keep the three evidence checks independent',()=>{
 let n=0;for(const scope of choices.scope)for(const overlap of choices.overlap)for(const sample of choices.sample)for(const protocol of choices.protocol)for(const remove of choices.remove){const r=evaluate({scope,overlap,sample,protocol,remove});assert.deepEqual(r.audit,evaluate({scope,overlap}).audit);assert.deepEqual(r.uncertainty,evaluate({sample}).uncertainty);assert.deepEqual(r.ablation,evaluate({protocol,remove}).ablation);assert.equal(r.audit.wins+r.audit.losses+r.audit.ties,r.audit.n);n++;}assert.equal(n,144);
});
test('unsupported configuration values fail before calculation',()=>{
 for(const c of [null,[],{scope:'hidden'},{sample:0},{sample:'25'},{sample:true},{overlap:false},{protocol:'causal'},{remove:'model'},{unknown:1}])assert.throws(()=>normalize(c));
});
