import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,forward,sampleGradient,batch,train,update,logLoss,sigmoid} from '../src/lib/neural-network.mjs';
const close=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
test('neural-network forward pass matches independently calculated example',()=>{
 const f=forward(initial(),[1,0]);assert.deepEqual(f.a,[.7,-.5,.75]);
 close(f.z,.5633503751930565);close(f.p,.6372273974891202);
 const r=sampleGradient(initial(),[1,0],1);close(r.loss,.45062870518331766);close(r.gradient[0],-.09210645318985008);
 close(batch(initial()).gradient[0],.025594383368197825);
 close(r.gradient[1],0);assert.equal(initial().length,13);assert.equal(initial('linear').length,3);
});
test('all backpropagation derivatives agree with independent finite differences',()=>{
 for(const a of ['linear','hidden'])for(const n of [0,100]){
  const theta=train(a,n).theta,g=batch(theta).gradient,eps=1e-5;
  for(let i=0;i<theta.length;i++){const plus=[...theta],minus=[...theta];plus[i]+=eps;minus[i]-=eps;close(g[i],(batch(plus).loss-batch(minus).loss)/(2*eps),2e-8);}
 }
});
test('training uses the batch mean and simultaneous old-parameter updates',()=>{
 const theta=initial(),b=batch(theta),before=[...theta],next=update(theta,b.gradient,.5);
 assert.deepEqual(theta,before);close(next[0],.5872028083159011);
 assert.deepEqual(train('hidden',1).theta,next);assert.ok(batch(next).loss<b.loss);
 for(let i=0;i<13;i++)close(b.gradient[i],[ [1,0,1],[0,1,1],[1,1,0],[0,0,0] ].reduce((s,[x1,x2,y])=>s+sampleGradient(theta,[x1,x2],y).gradient[i],0)/4);
});
test('the nonlinear network fits XOR while the logistic score remains uninformative',()=>{
 const h=train('hidden',2000),l=train('linear',2000);
 assert.equal(h.accuracy,1);assert.ok(h.loss<.003);assert.ok(h.rows.every(r=>r.y?r.p>.99:r.p<.01));
 close(l.loss,Math.log(2));assert.ok(l.rows.every(r=>Math.abs(r.p-.5)<1e-10));
 assert.equal(h.history[0].step,0);assert.equal(h.history.at(-1).step,2000);assert.equal(h.history.length,101);
});
test('stable binary loss handles extreme logits without clipping or overflow',()=>{
 assert.equal(sigmoid(1000),1);assert.equal(sigmoid(-1000),0);
 assert.equal(logLoss(1000,0),1000);assert.equal(logLoss(-1000,1),1000);
 close(logLoss(0,1),Math.log(2));assert.equal(logLoss(-1000,0),0);
});
test('inference is deterministic, needs no label, and does not mutate parameters',()=>{
 const theta=train('hidden',100).theta,before=[...theta],a=forward(theta,[0,1]);
 assert.deepEqual(forward(theta,[0,1]),a);assert.deepEqual(theta,before);assert.ok(!('y' in a));
 assert.deepEqual(train('hidden',1),train('hidden',1));
});
test('invalid architecture, budgets, rates, labels and numerical inputs fail clearly',()=>{
 for(const n of [-1,2001,1.5,NaN])assert.throws(()=>train('hidden',n));
 for(const rate of [0,-1,Infinity,NaN,2.1])assert.throws(()=>train('hidden',0,rate));
 assert.throws(()=>train('other'));assert.throws(()=>forward([1,2],[0,1]));assert.throws(()=>forward(initial(),[NaN,1]));assert.throws(()=>sampleGradient(initial(),[0,1],2));assert.throws(()=>update(initial(),[1],.5));
});
