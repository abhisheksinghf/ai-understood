import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluate,search,choices,normalize} from '../src/lib/reasoning.mjs';
import data from '../public/downloads/chapter-37-reasoning/data.json' with {type:'json'};
test('Bayes default calculation and expected utility match hand calculations',()=>{
 const r=evaluate();assert.equal(r.posterior,.8);assert.equal(r.evidenceProbability,.5);assert.equal(r.eligible,2);assert.equal(r.chosen,'M01');assert.equal(r.rows[0].enjoyment,.78);assert.equal(r.bestUtility,3.02);
});
test('missing evidence preserves the prior; disliked evidence is not missing',()=>{
 assert.equal(evaluate({evidence:'unknown',prior:20}).posterior,.2);
 assert.equal(evaluate({evidence:'disliked',prior:20}).posterior,.058824);
 assert.equal(evaluate({evidence:'disliked',prior:20}).chosen,'M02');
});
test('constraints cannot be outweighed by utility',()=>{
 assert.equal(evaluate({minutes:80}).decision,'no_feasible_movie');
 assert.equal(evaluate({minutes:120,offline:'no'}).chosen,'M03');
 const r=evaluate({minutes:120});assert.equal(r.chosen,'M01');assert.deepEqual(r.rows[2].reasons,['Not downloaded']);
});
test('abstaining differs from infeasibility; equal utility uses catalog order',()=>{
 const r=evaluate({evidence:'unknown',penalty:10});assert.equal(r.eligible,2);assert.equal(r.chosen,null);assert.equal(r.decision,'abstain');
 assert.equal(evaluate({evidence:'unknown'}).chosen,'M01');
});
test('all 162 combinations respect an independent Bayes/decision oracle',()=>{
 let n=0;for(const minutes of choices.minutes)for(const offline of choices.offline)for(const evidence of choices.evidence)for(const prior of choices.prior)for(const penalty of choices.penalty){
  const r=evaluate({minutes,offline,evidence,prior,penalty});
  const odds=prior/(100-prior)*(evidence==='liked'?4:evidence==='disliked'?.25:1);
  assert.ok(Math.abs(r.posterior-odds/(1+odds))<.000001);
  const feasible=r.rows.filter(m=>m.minutes<=minutes&&(offline==='no'||m.downloaded));assert.equal(r.eligible,feasible.length);
  if(r.chosen){const row=r.rows.find(m=>m.id===r.chosen);assert.ok(feasible.includes(row));assert.ok(row.utility>0);assert.ok(feasible.every(m=>m.utility<=row.utility));}
  else assert.ok(feasible.every(m=>m.utility<=0));n++;
 }assert.equal(n,162);
});
test('UCS and A* improve the first discovered goal; BFS minimizes edges',()=>{
 assert.deepEqual(search('bfs').path,['Start','Ready']);assert.equal(search('bfs').cost,10);
 for(const s of ['ucs','astar']){assert.equal(search(s).cost,3);assert.deepEqual(search(s).path,['Start','Check','Pick','Ready']);}
 assert.deepEqual(search('ucs').expanded,['Start','Check','Detour','Pick','Ready']);assert.deepEqual(search('astar').expanded,['Start','Check','Pick','Ready']);
});
test('fixture heuristic is consistent and every reported edge and cost is real',()=>{
 assert.equal(data.heuristic.Ready,0);
 for(const [node,edges]of Object.entries(data.graph))for(const [next,cost]of edges)assert.ok(data.heuristic[node]<=cost+data.heuristic[next]);
 for(const s of ['bfs','ucs','astar']){const r=search(s);let cost=0;for(let i=1;i<r.path.length;i++)cost+=data.graph[r.path[i-1]].find(e=>e[0]===r.path[i])[1];assert.equal(cost,r.cost);}
});
test('invalid types and unknown configuration are rejected',()=>{
 for(const c of [null,[],{prior:'50'},{offline:true},{penalty:0},{minutes:95},{evidence:'maybe'},{extra:1}])assert.throws(()=>normalize(c));assert.throws(()=>search('greedy'));
});
