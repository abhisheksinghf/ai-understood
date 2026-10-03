import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluate,iou,detect,recommend,backtest,normalize,choices} from '../src/lib/applied-systems.mjs';
import data from '../public/downloads/chapter-39-applications/data.json' with {type:'json'};

test('box geometry and one-to-one detection matching',()=>{
 assert.equal(iou([0,0,10,10],[0,0,10,10]),1);assert.equal(iou([0,0,10,10],[20,0,30,10]),0);assert.equal(iou([0,0,10,10],[2,0,12,10]),2/3);
 const r=detect(.6);assert.deepEqual([r.tp,r.fp,r.fn,r.precision,r.recall],[3,2,1,.6,.75]);assert.equal(r.rows.find(p=>p.id==='P2').outcome,'FP: duplicate');assert.equal(r.rows.find(p=>p.id==='P7').match,null);assert.deepEqual(r.missed,['B2']);
 assert.deepEqual([detect(.9).tp,detect(.9).fp,detect(.9).fn],[1,1,3]);assert.equal(detect(.3).recall,1);
 assert.equal(detect(1).precision,null);assert.equal(detect(1).fn,4);
});
test('eligible ranking, hand scores, ties, and position-sensitive gain',()=>{
 const r=recommend(.5,2);assert.deepEqual(r.rows.map(m=>m.id),['M003','M005','M002','M004','M006']);assert.equal(r.rows[0].score,.75);assert.equal(r.precision,.5);assert.equal(r.recall,.5);assert.equal(r.ndcg,.613147);
 assert.deepEqual(r.excluded.map(m=>m.id),['M001','M007']);assert.equal(recommend(0,2).ndcg,.386853);assert.equal(recommend(.5,3).recall,1);assert.equal(recommend(.5,3).ndcg,.919721);
});
test('changing future relevance changes evaluation, not the ordering',()=>{
 const altered=structuredClone(data.recommendations);altered.movies.forEach(m=>m.relevant=false);
 const r=recommend(.5,2,altered);assert.deepEqual(r.rows.map(m=>[m.id,m.score]),recommend(.5,2).rows.map(m=>[m.id,m.score]));assert.equal(r.recall,null);assert.equal(r.ndcg,null);
});
test('rolling forecast source days precede the target and hand errors match',()=>{
 const r=backtest('seasonal7');assert.equal(r.mae,5);assert.equal(r.rmse,5);assert.deepEqual(r.rows[0],{day:15,origin:14,sourceDays:[8],prediction:45,actual:50,error:5});
 assert.equal(backtest('last').mae,22.142857);assert.equal(backtest('mean3').mae,31.904762);assert.equal(backtest('last').rows[1].prediction,50);
 for(const method of choices.forecast)for(const f of backtest(method).rows)assert.ok(f.sourceDays.every(d=>d<=f.origin&&d<f.day));
});
test('future values cannot change predictions issued earlier',()=>{
 for(const method of choices.forecast){const changed=[...data.demand];for(let i=14;i<changed.length;i++)changed[i]+=1000;assert.equal(backtest(method,changed,15).rows[0].prediction,backtest(method).rows[0].prediction);}
});
test('all 54 configurations preserve task independence and metric bounds',()=>{
 let n=0;for(const threshold of choices.threshold)for(const weight of choices.weight)for(const k of choices.k)for(const forecast of choices.forecast){const r=evaluate({threshold,weight,k,forecast});assert.equal(r.vision.tp+r.vision.fn,4);assert.equal(r.vision.tp+r.vision.fp,r.vision.rows.length);assert.equal(new Set(r.vision.rows.filter(p=>p.match).map(p=>p.match)).size,r.vision.tp);assert.equal(r.recommendations.rows.filter(m=>m.selected).length,k);assert.ok(r.recommendations.ndcg>=0&&r.recommendations.ndcg<=1);assert.deepEqual(r.vision,evaluate({threshold}).vision);assert.deepEqual(r.forecast,evaluate({forecast}).forecast);n++;}assert.equal(n,54);
});
test('bad configurations fail before evaluation',()=>{
 for(const c of [null,[],{threshold:0},{weight:'0.5'},{k:0},{k:true},{forecast:'future'},{extra:1}])assert.throws(()=>normalize(c));
});
