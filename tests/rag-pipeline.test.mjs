import test from 'node:test';
import assert from 'node:assert/strict';
import {dataset,experiment,chunkSources,checkCandidate,pack,sourceBlock,units} from '../src/lib/rag-pipeline.mjs';
test('source revisions, chunk boundaries, and unchanged movie facts',async()=>{
 const {dataset:prior}=await import('../src/lib/information-retrieval.mjs');
 for(const movie of dataset.movies){const {revision,...record}=movie;assert.equal(revision,1);assert.deepEqual(record,prior.movies.find(d=>d.id===record.id));}
 assert.equal(chunkSources().length,8);assert.equal(chunkSources(dataset,'section').length,16);
 const changed=structuredClone(dataset);changed.movies[3].revision=2;changed.movies[3].runtime_minutes=112;
 const r=experiment('runtime','card',3,120,'all','none',changed);assert.equal(r.validation.evidence[0].source_id,'M004:r2:card');assert.equal(r.validation.evidence[0].quote,'Runtime: 112 minutes.');
});
test('retrieval and packing lose evidence at distinct stages',()=>{
 const full=experiment();assert.equal(full.validation.status,'evidence_ready');assert.equal(full.context.used,43);assert.deepEqual(full.candidates.map(c=>c.id),['M004:r1:card','M006:r1:card']);
 const top=experiment('plot','section',1);assert.equal(top.candidates[0].id,'M004:r1:facts');assert.equal(top.validation.status,'insufficient_evidence');
 const recovered=experiment('plot','section',3,50);assert.equal(recovered.context.used,48);assert.equal(recovered.validation.evidence[0].source_id,'M004:r1:plot');
 const lost=experiment('plot','section',3,20);assert.equal(lost.context.used,11);assert.equal(lost.context.omitted.length,2);assert.equal(lost.validation.status,'insufficient_evidence');
 assert.equal(experiment('runtime','section',1,20).validation.evidence[0].quote,'Runtime: 110 minutes.');
 assert.equal(experiment('streaming').validation.status,'insufficient_evidence');assert.equal(experiment('plot','card',3,0).context.selected.length,0);
});
test('packing preserves complete blocks and can skip to a smaller later candidate',()=>{
 const candidates=experiment('space').candidates;const packed=pack(candidates,21);assert.deepEqual(packed.selected.map(c=>c.movie_id),['M004']);assert.equal(packed.used,21);
 assert.equal(units(sourceBlock(packed.selected[0])),21);
 for(const q of dataset.queries)for(const mode of ['card','section'])for(const budget of [0,20,50,120]){
  const r=experiment(q.id,mode,5,budget,'under120');assert.ok(r.context.used<=budget);assert.ok(r.candidates.every(c=>c.runtime_minutes!==null&&c.runtime_minutes<120));assert.ok(r.context.selected.every(c=>r.prompt.user.includes(sourceBlock(c))));
 }
});
test('validator rejects missing context citations, fabricated quotes, and malformed candidates',()=>{
 const r=experiment();for(const fault of ['bad_id','bad_quote'])assert.equal(experiment('plot','card',3,120,'all',fault).validation.status,'blocked');
 for(const candidate of [null,[],{}, {status:'answer',claims:[]},{status:'insufficient_evidence',claims:[{source_id:r.context.selected[0].id,quote:'Runtime: 110 minutes.'}]},{status:'answer',claims:[null]},{status:'answer',claims:[{source_id:r.context.selected[0].id,quote:'Runtime: 110 minutes.',extra:true}]}])assert.equal(checkCandidate(candidate,r.context.selected).status,'blocked');
 assert.equal(checkCandidate(r.candidate,[]).status,'blocked');
 const mixed={status:'answer',claims:[r.candidate.claims[0],{source_id:'missing',quote:'Runtime: 110 minutes.'}]};assert.deepEqual(checkCandidate(mixed,r.context.selected).evidence,[]);
});
test('traceability deliberately cannot prove relevance',()=>{
 const r=experiment();const wrong=r.context.selected.find(c=>c.movie_id==='M006');
 const result=checkCandidate({status:'answer',claims:[{source_id:wrong.id,quote:dataset.movies[5].summary}]},r.context.selected);
 assert.equal(result.status,'evidence_ready');assert.equal(result.evidence[0].movie_id,'M006');
});
test('reject invalid settings and bad source snapshots',()=>{
 for(const args of [['missing'],['plot','bad'],['plot','card',0],['plot','card',3,-1],['plot','card',3,120,'bad'],['plot','card',3,120,'all','bad']])assert.throws(()=>experiment(...args));
 for(const mutate of [d=>d.movies.push(d.movies[0]),d=>d.movies[0].revision=0,d=>d.movies[0].runtime_minutes=-1,d=>d.movies[0].summary='',d=>d.queries[0].field='bad']){const d=structuredClone(dataset);mutate(d);assert.throws(()=>chunkSources(d));}
});
