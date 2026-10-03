import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateThreshold } from '../src/lib/threshold.mjs';

test('worked examples and exercise calculations match the chapter', ()=>{
  for (const [threshold, expected] of [[.70,[2,1,3,2,.625]],[.40,[4,2,2,0,.75]],[.60,[3,1,3,1,.75]],[.90,[1,0,4,3,.625]]]) {
    const r=evaluateThreshold(threshold);
    assert.deepEqual([r.tp,r.fp,r.tn,r.fn,r.accuracy], expected);
  }
});
test('threshold equality is flagged and extreme thresholds behave consistently', ()=>{
  assert.equal(evaluateThreshold(.73).rows.find(x=>x.id==='C').flagged,true);
  assert.equal(evaluateThreshold(0).rows.filter(x=>x.flagged).length,8);
  assert.equal(evaluateThreshold(1).rows.filter(x=>x.flagged).length,0);
});
