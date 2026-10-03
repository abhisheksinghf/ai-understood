import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog,defaultPreferences,recommend,validateCatalog} from '../src/lib/movie-project.mjs';
import cases from '../public/downloads/chapter-11-movie-project/eval_cases.json' with {type:'json'};
test('movie policy matches the authored acceptance cases',()=>{
  for(const c of cases)assert.equal(recommend(c.preferences).recommendation?.movie_id??null,c.expected_id,c.name);
});
test('eligible movies always satisfy required constraints',()=>{
  for(let max_minutes=30;max_minutes<=240;max_minutes++){
    const p={...defaultPreferences,max_minutes,seen_ids:['M001']};
    for(const id of recommend(p).eligible_ids){
      const m=catalog.movies.find(m=>m.id===id);
      assert.ok(m.genres.includes(p.genre)&&m.runtime_minutes!==null&&m.runtime_minutes<=max_minutes&&!p.seen_ids.includes(id));
    }
  }
});
test('movie validation distinguishes missing from invalid data',()=>{
  for(const change of [{max_minutes:true},{max_minutes:120.5},{max_minutes:29},{max_minutes:241},{genre:'unknown'},{seen_ids:['M999']},{seen_ids:['M001','M001']},{prefer_light:'yes'},{extra:1}])assert.throws(()=>recommend({...defaultPreferences,...change}));
  for(const change of [{runtime_minutes:true},{runtime_minutes:-1},{title:''},{streaming_service:42},{genres:['adventure','adventure']}]){
    const data=structuredClone(catalog);Object.assign(data.movies[0],change);assert.throws(()=>validateCatalog(data));
  }
  assert.equal(recommend(defaultPreferences,{version:'test',movies:[catalog.movies.at(-1)]}).status,'no_match');
  assert.equal(recommend(defaultPreferences,{version:'empty',movies:[]}).status,'no_match');
});
test('tie-break is stable and selection does not mutate the catalog',()=>{
  const data=structuredClone(catalog);data.movies.unshift({...data.movies[0],id:'M008',title:'Twin Map'});
  const before=structuredClone(data);
  assert.equal(recommend(defaultPreferences,data).recommendation.movie_id,'M001');assert.deepEqual(data,before);
  data.movies.push({...data.movies[0]});assert.throws(()=>validateCatalog(data));
});
