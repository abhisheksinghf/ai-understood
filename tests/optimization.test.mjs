import test from 'node:test';
import assert from 'node:assert/strict';
import {bowlLoss,bowlGradient,descentTrace,descentRates,entropy,crossEntropy,klDivergence} from '../src/lib/optimization.mjs';
const near=(a,b,tolerance=1e-9)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
test('gradient agrees with finite differences and descent has its claimed closed form',()=>{
  for(const w of [-2,0,1.5,3,6])near(bowlGradient(w),(bowlLoss(w+1e-5)-bowlLoss(w-1e-5))/2e-5);
  for(const rate of descentRates)for(const start of [-2,0,3,6]){
    const trace=descentTrace(start,rate,12);
    trace.forEach(row=>{near(row.w,3+(start-3)*(1-rate)**row.step);near(row.loss,.5*(row.w-3)**2);});
  }
  const step=descentTrace(0,.5,1)[1];assert.equal(step.w,1.5);assert.equal(step.loss,1.125);
});
test('optimizer distinguishes convergence, oscillation, divergence, and a stationary start',()=>{
  for(const rate of [.1,.5,1,1.5]){const t=descentTrace(0,rate,12);assert.ok(t.slice(1).every((r,i)=>r.loss<=t[i].loss));}
  assert.equal(descentTrace(0,1,1)[1].w,3);
  assert.deepEqual(descentTrace(0,2,3).map(r=>r.w),[0,6,0,6]);
  assert.ok(descentTrace(0,2.2,12)[12].loss>4.5);
  for(const rate of descentRates)assert.ok(descentTrace(3,rate,12).every(r=>r.w===3&&r.loss===0));
  for(const args of [[NaN,.5,1],[7,.5,1],[0,-1,1],[0,.5,13]])assert.throws(()=>descentTrace(...args));
});
test('information measures match coding examples and handle zero support',()=>{
  near(entropy([.5,.5]),1);near(entropy([.75,.25]),.8112781244591328);near(entropy([1,0]),0);
  near(crossEntropy([.75,.25],[.5,.5]),1);near(klDivergence([.75,.25],[.5,.5]),.18872187554086717);
  near(crossEntropy([.75,.25],[.75,.25]),entropy([.75,.25]));
  near(crossEntropy([1,0],[.8,.2]),-Math.log2(.8));
  assert.equal(crossEntropy([.75,.25],[1,0]),Infinity);near(crossEntropy([1,0],[1,0]),0);
  assert.notEqual(klDivergence([.75,.25],[.5,.5]),klDivergence([.5,.5],[.75,.25]));
  for(const values of [[.4,.4],[-.1,1.1],[NaN,1],[]])assert.throws(()=>entropy(values));
  assert.throws(()=>crossEntropy([1],[.5,.5]));
});
