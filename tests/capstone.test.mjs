import test from 'node:test';
import assert from 'node:assert/strict';
import {data,evaluate,run} from '../src/lib/capstone.mjs';
test('capstone: independent expected baseline and improved counts',()=>{
 assert.equal(evaluate().passed,8);
 const baseline=evaluate({constraints:false,aliases:false});
 assert.deepEqual([baseline.passed,baseline.violations,baseline.gate],[4,3,'Needs work']);
 assert.equal(evaluate({aliases:false}).passed,7);
});
test('capstone: higher overlap cannot override runtime eligibility',()=>{
 const result=run(data.cases[0].request);
 assert.equal(result.movie_id,'M001');assert.equal(result.value,105);
 assert.deepEqual(result.sources,['M001:r1:card']);
 assert.equal(result.candidates[0].score,2);assert.equal(result.candidates[0].eligible,false);
 assert.equal(run(data.cases[0].request,{constraints:false}).movie_id,'M002');
});
test('capstone: inclusive runtime boundary and seen exclusions',()=>{
 const r={intent:'recommend',query:'space',max_minutes:105,seen:[]};
 assert.equal(run(r).movie_id,'M001');assert.equal(run({...r,max_minutes:104}).status,'no_match');
 assert.equal(run({...r,seen:['M001']}).status,'no_match');
});
test('capstone: aliases collapse duplicated tokens and catalog order breaks ties',()=>{
 const r=run({intent:'recommend',query:'cosmic SPACE space',max_minutes:200,seen:[]});
 assert.equal(r.movie_id,'M002');assert.equal(r.candidates[0].score,1);
 assert.equal(run({intent:'recommend',query:'detective comedy',max_minutes:100,seen:[]}).movie_id,'M004');
});
test('capstone: tool failure is honest but task-incomplete',()=>{
 const r=run(data.cases[5].request,{tool:'timeout'});
 assert.deepEqual([r.status,r.value,r.sources],['tool_unavailable',null,[]]);
 const e=evaluate({tool:'timeout'});assert.deepEqual([e.passed,e.violations,e.toolFailures,e.gate],[7,0,1,'Needs work']);
});
test('capstone: distinguish unknown availability, missing IDs and unsupported facts',()=>{
 assert.equal(run({intent:'availability',movie_id:'M001',region:'US'}).status,'unknown_availability');
 assert.equal(run({intent:'runtime',movie_id:'M999'}).status,'not_found');
 assert.equal(run({intent:'director',movie_id:'M001'}).status,'unsupported_question');
});
test('capstone: malformed inputs and unknown configuration fail explicitly',()=>{
 const r=data.cases[0].request;
 for(const input of [null,[],{}, {...r,max_minutes:true},{...r,max_minutes:-1},{...r,max_minutes:105.5},{...r,query:'!'},{...r,seen:'M001'},{...r,execute:'anything'},{intent:'availability',movie_id:'M001',region:['IN']}])assert.equal(run(input).status,'invalid_input');
 for(const c of [{constraints:1},{tool:'live'},{extra:true},[]])assert.throws(()=>evaluate(c));
});
test('capstone: all eight configurations preserve inputs and trace evidence',()=>{
 const original=JSON.stringify(data);
 for(const constraints of [true,false])for(const aliases of [true,false])for(const tool of ['online','timeout']){
  const r=evaluate({constraints,aliases,tool});assert.equal(r.rows.length,8);
  assert.equal(r.evidenceFailures,0);
  for(const row of r.rows)assert.ok(row.result.trace.length>0);
 }
 assert.equal(JSON.stringify(data),original);
});
