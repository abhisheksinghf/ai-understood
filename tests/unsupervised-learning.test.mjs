import test from 'node:test';
import assert from 'node:assert/strict';
import {dataset,experiment,validateDataset,clusterTrace,fitPca,nearest,distance2} from '../src/lib/unsupervised-learning.mjs';
const near=(a,b,t=1e-10)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);

test('k-means agrees with the worked mean and inertia',()=>{
  const r=experiment();assert.equal(r.trace[0].inertia,75);near(r.state.inertia,307/6);
  assert.deepEqual(r.state.centers,[[23/6,14/6],[2,9],[8.5,8.5]]);assert.equal(r.state.step,1);
});
test('every exposed fit reduces the objective and reaches self-consistent means',()=>{
  const original=structuredClone(dataset);
  for(const k of [2,3])for(const start of ['spread','first'])for(const weight of [1,3]){
    const r=experiment('clusters',k,start,weight),points=r.movies.map(m=>[m.action,m.humor*weight]);
    for(const [i,s] of r.trace.entries()){
      assert.deepEqual(s.assignments,nearest(points,s.centers));assert.equal(s.assignments.length,9);
      near(s.inertia,points.reduce((sum,p)=>sum+Math.min(...s.centers.map(c=>distance2(p,c))),0));
      if(i)assert.ok(s.inertia<=r.trace[i-1].inertia+1e-10);
    }
    assert.equal(r.state.converged,true);
    r.state.centers.forEach((c,j)=>{const rows=points.filter((_,i)=>r.state.assignments[i]===j);for(const d of [0,1])near(c[d],rows.reduce((sum,p)=>sum+p[d],0)/rows.length);});
  }
  assert.deepEqual(dataset,original);
});
test('starts, weighting, empty centers and tied distances have explicit behavior',()=>{
  near(experiment('clusters',3,'first').state.inertia,166/3);
  assert.equal(distance2([2,9],[3,12]),10);
  const a=experiment('clusters',2,'spread',1).state.assignments,b=experiment('clusters',2,'spread',3).state.assignments;
  assert.notEqual(a[4],a[7]);assert.equal(b[4],b[7]);assert.deepEqual(nearest([[1,0]],[[0,0],[2,0]]),[0]);
  const last=clusterTrace([[2,2],[2,2],[2,2]]).at(-1);assert.equal(last.clusters_found,1);assert.equal(last.inertia,0);assert.equal(last.converged,true);
  const points=dataset.movies.map(m=>[m.action,m.humor*3]);assert.equal(clusterTrace(points,3,'first',1).at(-1).converged,false);assert.equal(clusterTrace(points,3,'first').at(-1).step,3);
});
test('PCA preserves projected variance and exposes discarded detail',()=>{
  const hand=fitPca([[1,1],[2,2],[3,3]]);near(hand.scores[2],Math.sqrt(2));near(hand.explained_ratio,1);near(hand.mean_squared_residual,0);
  const r=experiment('pca').model;near(r.explained_ratio,.6997313492235084);near(r.axis.reduce((sum,v)=>sum+v*v,0),1);near(r.scores.reduce((sum,z)=>sum+z,0),0);near(r.mean_squared_residual,r.eigenvalues[1]);
  dataset.movies.forEach((m,i)=>near((m.action-r.reconstructed[i][0])*r.axis[0]+(m.humor-r.reconstructed[i][1])*r.axis[1],0));
  assert.deepEqual(experiment('pca'),experiment('pca',2,'first',3,0));assert.deepEqual(fitPca([[1,0],[-1,0],[0,1],[0,-1]]).axis,[1,0]);
});
test('invalid movie data and undefined PCA variance fail explicitly',()=>{
  for(const value of [null,true,'3',NaN,Infinity,-1,11]){const bad=structuredClone(dataset);bad.movies[0].action=value;assert.throws(()=>validateDataset(bad));}
  const bad=structuredClone(dataset);bad.movies[1].id='M001';assert.throws(()=>validateDataset(bad));
  assert.throws(()=>fitPca([[2,2],[2,2]]));assert.throws(()=>clusterTrace([[1,1],[2,2],[3,3]],3,'spread',-1));assert.throws(()=>experiment('clusters',4));
});
