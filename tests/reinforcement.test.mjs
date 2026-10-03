import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluate,choices,normalize,tdUpdate,makeRandom} from '../src/lib/reinforcement.mjs';
test('terminal updates ignore future values; TD credit propagates across steps',()=>{
 assert.deepEqual(tdUpdate(0,6,99,.5,.9,true),{target:6,error:6,updated:3});
 assert.deepEqual(tdUpdate(0,-1,6,.5,.9,false),{target:4.4,error:4.4,updated:2.2});
 assert.equal(tdUpdate(0,-1,0,.5,.9,false).updated,-.5);
});
test('no exploration stays on the initially preferred familiar movie',()=>{
 const r=evaluate({epsilon:0});assert.equal(r.greedy.total,2);assert.equal(r.greedy.discounted,2);assert.equal(r.gap,2.4);assert.equal(r.exploratorySteps,0);assert.equal(r.rows[1].visits,0);assert.equal(r.rows[3].visits,0);assert.equal(r.rows[0].visits,200);
});
test('default learns delayed value; a click proxy optimizes a different outcome',()=>{
 const r=evaluate();assert.deepEqual(r.greedy.trace.map(a=>a.action),['ask','match']);assert.equal(r.greedy.discounted,4.4);assert.equal(r.greedy.total,5);assert.equal(r.trainingMean,3.175);assert.equal(r.gap,0);
 const proxy=evaluate({objective:'clicks'});assert.equal(proxy.greedy.discounted,4);assert.equal(proxy.greedy.satisfaction,2);assert.equal(proxy.gap,0);
 assert.equal(evaluate({episodes:60}).rows[3].visits,0);
});
test('seeded training is reproducible and resets all Q values on rerun',()=>{
 assert.deepEqual(evaluate(),evaluate());assert.notDeepEqual(evaluate().history,evaluate({seed:19}).history);
 const rng=makeRandom(7);assert.equal(rng(),1025555898/4294967296);
});
test('every setting obeys return, visit, terminal and independent optimal-value checks',()=>{
 let n=0;for(const objective of choices.objective)for(const epsilon of choices.epsilon)for(const gamma of choices.gamma)for(const alpha of choices.alpha)for(const episodes of choices.episodes)for(const seed of choices.seed){
  const r=evaluate({objective,epsilon,gamma,alpha,episodes,seed});
  assert.equal(r.history.length,episodes);assert.equal(r.rows.reduce((sum,row)=>sum+row.visits,0),r.steps);assert.equal(r.rows[0].visits+r.rows[1].visits,episodes);assert.equal(r.rows[1].visits,r.rows[2].visits+r.rows[3].visits);
  const oracle=objective==='satisfaction'?Math.max(2,-1+gamma*6):4;assert.ok(Math.abs(r.optimal.discounted-oracle)<1e-6);assert.ok(r.greedy.discounted<=oracle+1e-6);
  assert.equal(r.greedy.total,r.greedy.trace.reduce((s,a)=>s+a.reward,0));assert.ok(Math.abs(r.greedy.discounted-r.greedy.trace.reduce((s,a,i)=>s+gamma**i*a.reward,0))<1e-6);
  assert.equal(r.greedy.trace.at(-1).next,'terminal');assert.ok(r.history.every(h=>[1,2].includes(h.steps)));
  for(const u of r.updates){if(u.terminal){assert.equal(u.target,u.reward);assert.equal(u.nextMax,0);}assert.ok(Math.abs(u.updated-(u.old+alpha*(u.target-u.old)))<2e-6);}
  if(gamma===0)assert.equal(r.greedy.trace[0].action,'quick');n++;
 }assert.equal(n,144);
});
test('invalid configurations are rejected',()=>{
 for(const c of [null,[],{objective:'profit'},{epsilon:1},{gamma:'0.9'},{alpha:0},{episodes:true},{seed:0},{extra:2}])assert.throws(()=>normalize(c));
});
