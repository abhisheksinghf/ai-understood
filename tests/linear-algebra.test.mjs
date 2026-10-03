import test from 'node:test';
import assert from 'node:assert/strict';
import {dot,norm,cosine,matvec,transforms} from '../src/lib/linear-algebra.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);

test('chapter predictions and geometric examples match independent arithmetic',()=>{
  near(dot([3,2],[2,.5])+1,8);
  assert.deepEqual(matvec([[1,0],[2,1],[3,2]],[2,.5]).map(x=>x+1),[3,5.5,8]);
  near(norm([3,4]),5);near(norm([3,4].map(x=>x/5)),1);
  near(dot([3,4],[6,8]),50);near(cosine([3,4],[6,8]),1);
  near(cosine([3,4],[-4,3]),0);near(cosine([3,4],[-3,-4]),-1);
  assert.equal(cosine([0,0],[1,0]),null);
});
test('transforms preserve or discard information as described',()=>{
  const expected=[[2,1],[4,1],[-1,2],[3,1],[2,0]];
  transforms.forEach((t,i)=>assert.deepEqual(matvec(t.matrix,[2,1]),expected[i]));
  const rotation=transforms.find(t=>t.id==='rotate').matrix;
  const projection=transforms.find(t=>t.id==='collapse').matrix;
  for(const v of [[3,4],[-2,1],[0,0],[.5,-1.5]]){
    near(norm(matvec(rotation,v)),norm(v));
    assert.deepEqual(matvec(projection,matvec(projection,v)),matvec(projection,v));
  }
  assert.deepEqual(matvec(projection,[2,1]),matvec(projection,[2,-3]));
});
test('composition order and invalid shapes cannot be silently confused',()=>{
  const scale=transforms.find(t=>t.id==='stretch').matrix;
  const rotation=transforms.find(t=>t.id==='rotate').matrix;
  assert.deepEqual(matvec(rotation,matvec(scale,[2,1])),[-1,4]);
  assert.deepEqual(matvec(scale,matvec(rotation,[2,1])),[-2,2]);
  for(const fn of [()=>dot([1,2],[3]),()=>dot([],[]),()=>dot([true],[1]),()=>dot([NaN],[1]),()=>matvec([[1,2],[3]],[1,2])])assert.throws(fn);
});
