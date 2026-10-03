import test from 'node:test';
import assert from 'node:assert/strict';
import {dataset,presets,initialize,fitScaler,transform,evaluate,optimizerStep,order,run,forward,validate} from '../src/lib/training-diagnostics.mjs';
const close=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
test('training21 scaler and initialization match the documented arithmetic',()=>{
 const s=fitScaler(dataset.train);close(s.mean[0],50);close(s.mean[1],.5);close(s.std[0],Math.sqrt(912.5));close(s.std[1],Math.sqrt(.09125));
 assert.equal(initialize().length,33);assert.deepEqual(initialize(),initialize());
 close(evaluate(initialize(),dataset.train).saturation,109/128);close(evaluate(initialize(),transform(dataset.train,s)).saturation,0);
 assert.deepEqual(fitScaler([{x:[1,1]},{x:[1,1]}]).std,[1,1]);
});
test('training21 manual derivatives including L2 match finite differences',()=>{
 const rows=transform(dataset.train,fitScaler(dataset.train));
 for(const theta of [initialize(),run('baseline',false,16,dataset,20).last.theta])for(const l2 of [0,.02]){
  const g=evaluate(theta,rows,l2).gradient,eps=1e-5;
  for(let i=0;i<theta.length;i++){const a=[...theta],b=[...theta];a[i]+=eps;b[i]-=eps;close(g[i],(evaluate(a,rows,l2).objective-evaluate(b,rows,l2).objective)/(2*eps),3e-8);}
 }
});
test('training21 Adam bias correction, SGD updates, and weight-only penalties are correct',()=>{
 const t=[1,-2],g=[.2,-.4],state={step:0,m:[0,0],v:[0,0]},a=optimizerStep(t,g,state,presets.baseline);
 close(a.theta[0],1-.03*.2/(.2+1e-8));close(a.theta[1],-2+.03*.4/(.4+1e-8));assert.equal(a.state.step,1);
 const b=optimizerStep(a.theta,g,a.state,presets.baseline);close(b.theta[0],1-2*.03*.2/(.2+1e-8));
 assert.deepEqual(optimizerStep(t,g,state,presets.sgd).theta,[.994,-1.988]);assert.deepEqual(t,[1,-2]);
 const weights=initialize('zero');weights[2]=3;weights[32]=4;close(evaluate(weights,dataset.train,.02).penalty,0);weights[0]=3;close(evaluate(weights,dataset.train,.02).penalty,.09);
});
test('training21 validation cannot fit scaler or alter fixed-budget training',()=>{
 const changed=structuredClone(dataset);changed.validation.forEach(r=>{r.x=[r.x[0]+300,r.x[1]+3];r.y=1-r.y;});
 const a=run('baseline',false,4,dataset,30),b=run('baseline',false,4,changed,30);
 assert.deepEqual(a.scaler,b.scaler);assert.deepEqual(a.last.theta,b.last.theta);assert.deepEqual(a.history.map(h=>h.train_loss),b.history.map(h=>h.train_loss));
 assert.notEqual(a.last.validation_loss,b.last.validation_loss);
});
test('training21 every epoch visits each row once and batch size changes update count',()=>{
 for(let e=1;e<=5;e++){const ids=order(16,e);assert.deepEqual([...ids].sort((a,b)=>a-b),Array.from({length:16},(_,i)=>i));assert.deepEqual(ids,order(16,e));}
 assert.equal(run('baseline',false,16,dataset,3).last.updates,3);assert.equal(run('baseline',false,4,dataset,3).last.updates,12);
});
test('training21 zero initialization stalls hidden weights and inference does not mutate them',()=>{
 const r=run('zero');assert.ok(r.last.theta.slice(0,32).every(v=>v===0));close(forward(r.last.theta,[1,1]).p,.625,1e-7);
 const theta=[...r.last.theta];forward(theta,[2,3]);assert.deepEqual(theta,r.last.theta);assert.ok(r.history[0].gradient_norm>0);
});
test('training21 best checkpoint is independently selected and copied, with explicit patience limits',()=>{
 const r=run('fast');assert.equal(r.best.epoch,112);close(r.best.validation_loss,.04187753458079985);close(r.last.validation_loss,.18986098500566193);
 assert.equal(r.best.validation_loss,Math.min(...r.history.map(h=>h.validation_loss)));assert.ok(r.last.train_loss<r.best.train_loss);assert.equal(r.last.validation_accuracy,11/12);
 const early=run('fast',true);assert.equal(early.last.epoch,46);assert.equal(early.best.epoch,16);close(early.best.validation_loss,.0737820285253551);
 const old=r.last.theta[0];r.best.theta[0]=999;assert.equal(r.last.theta[0],old);
});
test('training21 malformed datasets and unsupported controls fail explicitly',()=>{
 const a=structuredClone(dataset);a.validation[0].id=a.train[0].id;assert.throws(()=>validate(a));
 for(const v of [null,{train:[],validation:[]},{train:[null],validation:[{}]}])assert.throws(()=>validate(v));
 for(const e of [-1,0,601,2.5])assert.throws(()=>run('baseline',false,16,dataset,e));
 assert.throws(()=>run('other'));assert.throws(()=>run('baseline',false,3));assert.throws(()=>run('baseline','true'));assert.throws(()=>initialize('bad'));
 const b=structuredClone(dataset);b.train[0].x[0]=NaN;assert.throws(()=>validate(b));
});
