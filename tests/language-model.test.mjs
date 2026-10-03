import test from 'node:test';
import assert from 'node:assert/strict';
import {data,tokenize,trainBPE,words,fitBigram,distribution,decoding,generate,score,explore} from '../src/lib/language-model.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
test('BPE learns counted pairs in deterministic order; encoding does not refit',()=>{
 const m=trainBPE(16);assert.deepEqual(m.merges[0],{rank:1,left:115,right:32,id:256,count:10,piece:'s␠'});assert.equal(m.vocabulary.length,272);
 const encoded=tokenize();assert.deepEqual(encoded.ids,[270,102,268,46]);assert.deepEqual(encoded.tokens.map(t=>t.piece),['this␠movie␠is␠','f','un','.']);assert.deepEqual(tokenize('zzzzzz').merges,encoded.merges);
});
test('byte fallback round trips empty text, whitespace, accents, emoji, and BOM',()=>{
 for(const text of ['',...data.samples,'\ufeffthis\nmovie\t','e\u0301','电影 🎬'])for(const budget of [0,8,16,24]){const r=tokenize(text,budget);assert.equal(r.decoded,text);assert.equal(r.roundtrip,true);assert.equal(r.byte_count,Buffer.byteLength(text,'utf8'));assert.deepEqual(r.tokens.flatMap(t=>t.bytes),Array.from(Buffer.from(text)));}
 const r=tokenize('🎬',0);assert.equal(r.codepoints,1);assert.equal(r.byte_count,4);assert.equal(r.ids.length,4);assert.ok(r.tokens.every(t=>t.piece.startsWith('hex ')));
});
test('merge budgets do not increase token count for this ordered encoding',()=>{
 for(const text of data.samples){let previous=Infinity;for(let n=0;n<=24;n++){const r=tokenize(text,n);assert.ok(r.ids.length<=previous);previous=r.ids.length;}}
 assert.notDeepEqual(tokenize('movie').ids,tokenize(' movie').ids);
});
test('bigram counts preserve sentence boundaries and use a separate word vocabulary',()=>{
 assert.deepEqual(words('Movie, FUN!'),['movie',',','fun','!']);const m=fitBigram();assert.equal(m.vocabulary.length,13);assert.equal(m.counts['<bos>'].reduce((a,b)=>a+b),6);assert.equal(m.counts['.'][m.vocabulary.indexOf('<eos>')],6);assert.equal(m.counts['<eos>'].reduce((a,b)=>a+b),0);
 assert.equal(distribution('is',0).rows.find(r=>r.token==='fun').count,2);
});
test('smoothing is a normalized count formula and empty unsmoothed contexts stay unsupported',()=>{
 for(const a of [0,1])for(const context of ['<bos>','is','movie','unknown']){const d=distribution(context,a);near(d.rows.reduce((s,r)=>s+r.probability,0),d.denominator?1:0);}
 near(distribution('is',0).rows.find(r=>r.token==='fun').probability,.5);const d=distribution('is',1);assert.equal(d.denominator,17);near(d.rows.find(r=>r.token==='fun').probability,3/17);assert.equal(generate('unknown',0).stop,'No observed continuation');
});
test('temperature sharpens or flattens, top-k removes and renormalizes, zeros remain zero',()=>{
 const d=distribution('is',1).rows,get=t=>decoding(d,t,0).find(r=>r.token==='fun').sampling_probability;assert.ok(get(.5)>get(1)&&get(1)>get(2));
 for(const t of [.5,1,2])for(const k of [0,3]){const rows=decoding(d,t,k);near(rows.reduce((s,r)=>s+r.sampling_probability,0),1);if(k)assert.equal(rows.filter(r=>r.sampling_probability>0).length,3);}
 const rows=decoding(distribution('is',0).rows,2,0);assert.ok(rows.filter(r=>!r.probability).every(r=>!r.sampling_probability));
});
test('greedy is stable across temperature; a bigram ignores older prefix context',()=>{
 for(const t of [.5,1,2])for(const k of [0,3])assert.deepEqual(generate('this movie is',1,t,k,'greedy').generated_tokens,['fun','.','<eos>']);
 assert.deepEqual(generate('this movie is').steps,generate('this film is').steps);
});
test('seeded sampling, end token, and length cap obey the generation contract',()=>{
 const a=generate(),b=generate();assert.deepEqual(a,b);assert.deepEqual(a.generated_tokens,['feels','<unk>','is','a','film','<eos>']);near(a.steps[0].draw,1083814273/4294967296);assert.equal(a.stop,'End token');assert.equal(generate(undefined,1,1,0,'greedy',42,1).stop,'Token limit');assert.equal(generate(undefined,1,1,0,'greedy',42,1).steps.length,1);
});
test('scoring uses observed prefixes and base probabilities, includes EOS, and exposes zeros',()=>{
 const s=score(undefined,0);assert.equal(s.target_count,6);near(s.mean_nll,Math.log(2)/2);near(s.perplexity,Math.sqrt(2));const bad=score(data.scores.unknown,0);assert.equal(bad.perplexity,null);assert.equal(bad.zero_probabilities,2);assert.deepEqual(bad.unknowns,['dazzling']);assert.ok(score(data.scores.unknown,1).perplexity>0);
 assert.deepEqual(explore(undefined,1,.5,3,'greedy').scoring,explore(undefined,1,2,0,'sample').scoring);
});
test('malformed text and invalid settings fail clearly',()=>{
 for(const t of ['x'.repeat(201),'\ud800',null])assert.throws(()=>tokenize(t));for(const n of [-1,25,.5])assert.throws(()=>trainBPE(n));assert.throws(()=>distribution('is',-1));assert.throws(()=>decoding([],0,0));assert.throws(()=>generate(undefined,1,1,0,'bad'));assert.throws(()=>generate(undefined,1,1,0,'sample',-1));assert.throws(()=>explore(undefined,1,1,0,'sample','bad'));
});
