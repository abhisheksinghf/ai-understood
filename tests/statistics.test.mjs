import test from 'node:test';
import assert from 'node:assert/strict';
import {summarize,alertScenario,knownSigmaInterval} from '../src/lib/statistics.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('descriptive summaries and outlier exercise match hand arithmetic',()=>{
  const values=[2,3,3,4,8],s=summarize(values);
  assert.equal(s.mean,4);assert.equal(s.median,3);near(s.sampleVariance,5.5);near(s.sampleSD,Math.sqrt(5.5));
  assert.equal(summarize([2,3,3,4,18]).mean,6);assert.equal(summarize([2,3,3,4,18]).median,3);
  assert.equal(summarize([2,8,3,3]).median,3);assert.deepEqual(values,[2,3,3,4,8]);
});
test('Bayes worked examples preserve totals and distinguish conditional directions',()=>{
  const a=alertScenario();assert.equal(a.truePositive,90);assert.equal(a.falsePositive,495);assert.equal(a.alerts,585);near(a.precision,2/13);
  near(alertScenario({baseRate:.1}).precision,2/3);near(alertScenario({baseRate:.5}).precision,18/19);
  for(const baseRate of [0,.01,.1,1])for(const recall of [0,.5,1])for(const falsePositiveRate of [0,.05,1]){
    const r=alertScenario({baseRate,recall,falsePositiveRate});near(r.truePositive+r.falsePositive+r.falseNegative+r.trueNegative,10000);
    near(r.truePositive+r.falseNegative,r.spamCount);near(r.falsePositive+r.trueNegative,r.legitimate);
    assert.ok(r.precision===null||r.precision>=0&&r.precision<=1);
  }
  assert.equal(alertScenario({baseRate:0,falsePositiveRate:0}).precision,null);
  assert.equal(alertScenario({recall:0,falsePositiveRate:0}).precision,null);
  assert.equal(alertScenario({baseRate:0,falsePositiveRate:.05}).precision,0);
  assert.equal(alertScenario({falsePositiveRate:0}).precision,1);
});
test('known-SD intervals halve width when sample size quadruples',()=>{
  const a=knownSigmaInterval(1,4,25),b=knownSigmaInterval(1,4,100);
  near(a.standardError,.8);near(a.low,-.568);near(a.high,2.568);
  near(b.low,.216);near(b.high,1.784);near(a.margin,2*b.margin);
  for(const fn of [()=>summarize([1]),()=>summarize([1,NaN]),()=>alertScenario({baseRate:-.01}),()=>alertScenario({recall:NaN}),()=>alertScenario({total:0}),()=>knownSigmaInterval(1,4,0)])assert.throws(fn);
});
