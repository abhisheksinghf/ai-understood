import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog,defaultPreferences,recommend,validateCatalog} from '../src/lib/movie-project.mjs';
import cases from '../public/downloads/chapter-11-movie-project/eval_cases.json' with {type:'json'};
test('note policy matches the authored acceptance cases',()=>{
  for(const c of cases)assert.equal(recommend(c.preferences).recommendation?.note_id??null,c.expected_id,c.name);
});
test('eligible notes always satisfy required constraints',()=>{
  for(let max_minutes=5;max_minutes<=120;max_minutes++){
    const p={...defaultPreferences,max_minutes,completed_ids:['N01']};
    for(const id of recommend(p).eligible_ids){
      const m=catalog.notes.find(m=>m.id===id);
      assert.ok(m.topics.includes(p.topic)&&m.estimated_minutes!==null&&m.estimated_minutes<=max_minutes&&!p.completed_ids.includes(id));
    }
  }
});
test('note validation distinguishes missing from invalid data',()=>{
  for(const change of [{max_minutes:true},{max_minutes:120.5},{max_minutes:4},{max_minutes:121},{topic:'unknown'},{completed_ids:['N99']},{completed_ids:['N01','N01']},{prefer_introductory:'yes'},{extra:1}])assert.throws(()=>recommend({...defaultPreferences,...change}));
  for(const change of [{estimated_minutes:true},{estimated_minutes:-1},{title:''},{text:''},{text:42},{exam_date:42},{topics:['learning','learning']}]){
    const data=structuredClone(catalog);Object.assign(data.notes[0],change);assert.throws(()=>validateCatalog(data));
  }
  assert.equal(recommend(defaultPreferences,{version:'test',notes:[catalog.notes.at(-1)]}).status,'no_match');
  assert.equal(recommend(defaultPreferences,{version:'empty',notes:[]}).status,'no_match');
});
test('tie-break is stable and selection does not mutate the catalog',()=>{
  const data=structuredClone(catalog);data.notes.unshift({...data.notes[0],id:'N08',title:'Duplicate note'});
  const before=structuredClone(data);
  assert.equal(recommend(defaultPreferences,data).recommendation.note_id,'N01');assert.deepEqual(data,before);
  data.notes.push({...data.notes[0]});assert.throws(()=>validateCatalog(data));
});
