import test from 'node:test';
import assert from 'node:assert/strict';
import {data,plan,assess,designKeys,configFlags} from '../src/lib/adaptation.mjs';
const c=id=>({...data.scenarios.find(s=>s.id===id).config});
const d=(...selected)=>Object.fromEntries(designKeys.map(k=>[k,selected.includes(k)]));
test('supplied facts need only a prompt baseline',()=>assert.deepEqual(plan(c('provided')).methods,['prompt']));
test('fine-tuning does not supply documents live state or actions',()=>assert.deepEqual(assess(c('hybrid'),d('fineTune')).missing,['rag','readTool','writeTool']));
test('each training prerequisite gates the trial',()=>{for(const k of ['baselineTested','examplesReady','evalReady']){const p=plan({...c('hybrid'),[k]:false});assert.equal(p.suggestedDesign.fineTune,false);assert.deepEqual(p.fineTuning.missing,[k]);}});
test('ready data alone does not justify training',()=>assert.deepEqual(plan({...c('hybrid'),behaviorGap:false}).fineTuning,{status:'Not indicated',missing:[]}));
test('behavior quality is distinct from capability coverage',()=>assert.equal(assess(c('hybrid'),d('rag','readTool','writeTool')).verdict,'Inputs and actions covered'));
test('unjustified fine-tuning requests a review of adaptation',()=>{const a=assess(c('provided'),d('rag','fineTune'));assert.deepEqual(a.extras,['rag','fineTune']);assert.equal(a.verdict,'Revisit adaptation choice');});
test('all configurations and component subsets preserve external role boundaries',()=>{
 for(const knowledge of data.knowledge.map(k=>k.id))for(let n=0;n<32;n++){
  const config={knowledge,...Object.fromEntries(configFlags.map((k,i)=>[k,!!(n&(1<<i))]))};const p=plan(config);assert.deepEqual(assess(config,p.suggestedDesign).missing,[]);
  for(let mask=0;mask<16;mask++){const design=Object.fromEntries(designKeys.map((k,i)=>[k,!!(mask&(1<<i))]));const result=assess(config,design);assert.deepEqual(result.missing,designKeys.slice(0,3).filter(k=>p.suggestedDesign[k]&&!design[k]));}
 }
});
test('results do not mutate their inputs or shared data',()=>{const before=structuredClone(data),config=c('hybrid'),p=plan(config),design=d();const a=assess(config,design);p.config.knowledge='provided';p.checks.push('changed');a.design.rag=true;assert.deepEqual(data,before);assert.deepEqual(config,c('hybrid'));assert.equal(design.rag,false);});
test('reject malformed requirements and design selections',()=>{for(const input of [null,{}, {...c('hybrid'),knowledge:'memory'}, {...c('hybrid'),writeAction:1},{...c('hybrid'),extra:true}])assert.throws(()=>plan(input));for(const input of [null,{}, {...d(),rag:1}])assert.throws(()=>assess(c('hybrid'),input));});
