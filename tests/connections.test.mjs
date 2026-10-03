import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../public/downloads/chapter-40-connections/data.json' with {type:'json'};
import {evaluate,propagate,standardize,queryReviews,entropy,normalize,choices} from '../src/lib/connections.mjs';
test('propagation follows hops and preserves the isolated node',()=>{
 assert.deepEqual(propagate(1,'chain').rows.map(n=>n.final),[.5,.25,0,0,.4]);
 assert.deepEqual(propagate(3,'chain').rows.map(n=>n.final),[.3125,.234375,.09375,.03125,.4]);
 assert.deepEqual(propagate(1,'shortcut').rows.map(n=>n.final),[.5,.25,0,.25,.4]);
 assert.deepEqual(propagate(0,'chain').rows.map(n=>n.final),[1,0,0,0,.4]);
 assert.equal(propagate(0,'chain').updates.length,0);
});
test('all updates use previous values regardless of iteration order',()=>{
 const reversed=structuredClone(data.graph);reversed.nodes.reverse();
 const a=propagate(3,'chain'),b=propagate(3,'chain',reversed);
 assert.deepEqual(a.history,b.history);
 assert.deepEqual(a.updates.find(u=>u.step===1&&u.id==='B'),{step:1,id:'B',neighbors:['A','C'],old:0,neighborMean:.5,updated:.25});
});
test('pooled and standardized contrasts expose the mixture reversal',()=>{
 const r=standardize('unbalanced',.5);
 assert.deepEqual([r.crudeWith,r.crudeWithout,r.crudeDifference],[.68,.42,.26]);
 assert.deepEqual([r.adjustedWith,r.adjustedWithout,r.adjustedDifference],[.5,.6,-.1]);
 assert.deepEqual(r.rows.map(g=>g.difference),[-.1,-.1]);
 assert.equal(standardize('balanced',.5).crudeDifference,-.1);
});
test('target weights change standardization without changing observations',()=>{
 const low=standardize('unbalanced',.25),high=standardize('unbalanced',.75);
 assert.deepEqual([low.adjustedWith,low.adjustedWithout],[.35,.45]);
 assert.deepEqual([high.adjustedWith,high.adjustedWithout],[.65,.75]);
 assert.equal(low.crudeDifference,high.crudeDifference);
 assert.equal(low.adjustedDifference,high.adjustedDifference);
});
test('entropy selection has stable ties and reveals only queried labels',()=>{
 assert.equal(entropy(0),0);assert.equal(entropy(1),0);assert.equal(entropy(.5),1);
 const r=queryReviews('uncertain',2);assert.deepEqual(r.selected,['R1','R2']);assert.equal(r.meanEntropy,.996387);
 assert.deepEqual(r.rows.map(q=>q.id),['R1','R2','R3','R4','R6','R5']);
 assert.ok(r.rows.filter(q=>!q.selected).every(q=>q.annotation===null));
 const confident=queryReviews('confident',2);assert.deepEqual(confident.selected,['R5','R6']);assert.equal(confident.meanEntropy,.111117);assert.equal(confident.rows[0].annotation,0);
});
test('changing hidden annotations cannot change query ranking',()=>{
 const changed=data.reviews.map(r=>({...r,label:1-r.label}));
 for(const strategy of choices.strategy){const a=queryReviews(strategy,2),b=queryReviews(strategy,2,changed);assert.deepEqual(a.selected,b.selected);assert.deepEqual(a.rows.map(r=>[r.id,r.p,r.entropy]),b.rows.map(r=>[r.id,r.p,r.entropy]));}
});
test('all 144 settings keep the three experiments independent',()=>{
 let count=0;for(const steps of choices.steps)for(const topology of choices.topology)for(const allocation of choices.allocation)for(const targetHigh of choices.targetHigh)for(const strategy of choices.strategy)for(const budget of choices.budget){const r=evaluate({steps,topology,allocation,targetHigh,strategy,budget});assert.deepEqual(r.graph,evaluate({steps,topology}).graph);assert.deepEqual(r.causal,evaluate({allocation,targetHigh}).causal);assert.deepEqual(r.active,evaluate({strategy,budget}).active);assert.equal(r.graph.history.length,steps+1);assert.equal(r.active.rows.filter(q=>q.annotation!==null).length,budget);assert.ok(r.graph.rows.every(n=>n.final>=0&&n.final<=1));count++;}assert.equal(count,144);
});
test('invalid configurations fail before calculation',()=>{
 for(const c of [null,[],{steps:2},{steps:true},{targetHigh:'0.5'},{allocation:'randomized'},{strategy:'labels'},{budget:0},{extra:1}])assert.throws(()=>normalize(c));
});
