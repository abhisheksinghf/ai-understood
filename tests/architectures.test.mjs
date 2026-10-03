import test from 'node:test';
import assert from 'node:assert/strict';
import {cnn,convolve,pool,sequence,transfer,forward,data} from '../src/lib/architectures.mjs';
const near=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
test('cross-correlation keeps orientation and sums weighted local patch entries',()=>{
 assert.deepEqual(convolve([[1,2,3],[4,5,6],[7,8,9]],[[1,0],[0,-1]]),[[-4,-4],[-4,-4]]);
 const r=cnn();assert.deepEqual(r.output,[[3,3,0],[3,3,0],[3,3,0]]);assert.deepEqual(r.pooled,[[3]]);assert.equal(r.global_mean,2);
});
test('padding inserts zeros, stride skips positions, shapes follow floor rule',()=>{
 assert.deepEqual(convolve([[1,2],[3,4]],[[1]],2,1),[[0,0],[0,4]]);
 for(const poster of Object.keys(data.posters))for(const filter of Object.keys(data.kernels))for(const s of [1,2])for(const p of [0,1]){const r=cnn(poster,filter,s,p),n=Math.floor((5+2*p-3)/s)+1;assert.equal(r.output.length,n);assert.equal(r.output[0].length,n);assert.ok(r.activation.flat().every(v=>v>=0));assert.equal(r.parameters,10);}
});
test('max pooling uses complete nonoverlapping windows and drops odd edges',()=>{
 assert.deepEqual(pool([[1,2,100],[3,4,100],[100,100,100]]),[[4]]);
 assert.deepEqual(pool([[-4,-2],[-3,-1]]),[[-1]]);
});
test('order changes recurrent state while the mean stays the same',()=>{
 const a=sequence(),b=sequence('reversed');near(a.mean,b.mean);assert.ok(a.real_final<0&&b.real_final>0);
 near(a.steps[0].state,Math.tanh(.8));near(a.steps[1].state,Math.tanh(.8+.5*a.steps[0].state));
 for(const history of ['original','reversed']){const r=sequence(history,0);near(r.real_final,Math.tanh(.8*r.inputs.at(-1)));}
});
test('masked padding preserves state; treating zeros as events changes it',()=>{
 const a=sequence(),b=sequence('original',.5,false);near(a.real_final,a.final);assert.notEqual(b.real_final,b.final);near(b.steps[3].state,Math.tanh(.5*b.real_final));
 assert.deepEqual(a.steps.slice(0,3),b.steps.slice(0,3));assert.equal(a.steps.filter(s=>s.skipped).length,2);
});
test('analytic gradients match central differences for all nine parameters',()=>{
 for(const y of [0,1]){const theta=[...data.transfer.theta],g=forward(theta,undefined,y).gradient;theta.forEach((_,i)=>{const a=[...theta],b=[...theta];a[i]+=1e-5;b[i]-=1e-5;near(g[i],(forward(a,undefined,y).loss-forward(b,undefined,y).loss)/2e-5);});}
});
test('one SGD step freezes exactly the backbone, and both modes improve this one example',()=>{
 const initial=JSON.stringify(data.transfer.theta),a=transfer(),b=transfer('finetune');assert.equal(a.trainable_count,3);assert.equal(b.trainable_count,9);assert.equal(a.backbone_change,0);assert.ok(b.backbone_change>0);assert.deepEqual(a.before.features,a.after.features);assert.deepEqual(a.after_theta.slice(6),b.after_theta.slice(6));
 for(const r of [a,b]){assert.ok(r.after.loss<r.before.loss);r.after_theta.forEach((p,i)=>near(p,r.before_theta[i]-(r.trainable[i]?r.rate*r.before.gradient[i]:0)));}assert.equal(JSON.stringify(data.transfer.theta),initial);
});
test('invalid matrices and configurations fail rather than silently changing the experiment',()=>{
 for(const m of [[],[[1],[2,3]],[[NaN]],[[Infinity]]])assert.throws(()=>convolve(m,[[1]]));
 assert.throws(()=>convolve([[1]],[[1,2]]));assert.throws(()=>convolve([[1]],[[1]],0));assert.throws(()=>pool([[1]]));assert.throws(()=>cnn('missing'));assert.throws(()=>sequence('original',.7));assert.throws(()=>sequence('original',.5,'yes'));assert.throws(()=>transfer('bad'));assert.throws(()=>forward([1]));
});
