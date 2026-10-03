import test from 'node:test';
import assert from 'node:assert/strict';
import {dataset,tokenize,buildIndex,termWeight,search,rankingMetrics} from '../src/lib/information-retrieval.mjs';
const ids=r=>r.results.map(d=>d.id);
test('inverted postings count documents separately from occurrences',()=>{
  const i=buildIndex();assert.equal(i.n,8);assert.equal(i.average_length,94/8);
  assert.equal(i.postings.get('space').size,3);assert.deepEqual(i.postings.get('space').get('M008'),[1,9]);
  assert.deepEqual(tokenize('Space, RESCUE!'),['space','rescue']);
});
test('ranking matches hand-calculated scores and stable overlap tie order',()=>{
  assert.deepEqual(ids(search()),['M008','M004','M005']);
  assert.deepEqual(ids(search('space rescue','overlap')),['M004','M008','M001']);
  const t=search('space rescue','tfidf').results.find(d=>d.id==='M004');assert.ok(Math.abs(t.score-Math.log(8/3)-Math.log(2))<1e-12);
  const bm=search().results.find(d=>d.id==='M004');assert.ok(Math.abs(bm.score-1.743859411164185)<1e-12);
});
test('AND is intersection, unknown words are not silently ignored, quotes are not phrases',()=>{
  assert.deepEqual(ids(search('space rescue','bm25','all')),['M008','M004']);
  assert.deepEqual(ids(search('space unknownword','bm25','all')),[]);
  assert.deepEqual(ids(search('space unknownword')),ids(search('space')));
  assert.deepEqual(ids(search('"space rescue"','bm25','all')),['M008','M004']);
  assert.deepEqual(ids(search('hilarious quest')),[]);assert.deepEqual(search('').tokens,[]);
});
test('filter before top K, exclude unknown runtime, retain full-corpus scores',()=>{
  const a=search('rescue','bm25','any','all',10),b=search('rescue','bm25','any','under120',10);
  assert.ok(a.results.some(d=>d.id==='M002'));assert.ok(!b.results.some(d=>d.id==='M002'));
  assert.equal(search('astronauts','bm25','any','under120').results.length,0);
  for(const row of b.results)assert.equal(row.score,a.results.find(d=>d.id===row.id).score);
  assert.equal(search('space rescue','bm25','any','under120').evaluation.recall_at_k,1);
});
test('judgments never alter ranking; duplicates do not boost queries; zero TF-IDF remains a match',()=>{
  const copy=structuredClone(dataset);copy.queries[0].relevant=[];
  assert.deepEqual(search('space rescue','bm25','any','all',3,1.2,.75,copy).results,search().results);
  assert.equal(search('space rescue','bm25','any','all',3,1.2,.75,copy).evaluation.recall_at_k,null);
  assert.deepEqual(search('space space rescue').results,search().results);
  const common=search('a','tfidf','any','all',10);assert.equal(common.results.length,8);assert.ok(common.results.every(d=>d.score===0));
  assert.equal(search('new arbitrary query').evaluation,null);
});
test('BM25 saturation and length normalization follow documented limits',()=>{
  const s=tf=>termWeight('bm25',tf,3,8,10,10,1.2,.75);
  assert.ok(s(2)-s(1)>s(3)-s(2));assert.ok(s(3)>s(2));
  assert.equal(termWeight('bm25',2,3,8,10,10,0,1),termWeight('bm25',100,3,8,30,10,0,1));
  assert.equal(termWeight('bm25',1,3,8,10,10,1.2,0),termWeight('bm25',1,3,8,30,10,1.2,0));
  assert.ok(termWeight('bm25',1,3,8,10,10)>termWeight('bm25',1,3,8,30,10));
  assert.equal(termWeight('bm25',0,3,8,10,10,0,0),0);
});
test('metrics handle short result lists, absent relevance, and first relevant rank',()=>{
  assert.deepEqual(rankingMetrics(['a','b'],['b','c'],3),{relevant_total:2,relevant_retrieved:1,precision_at_k:1/3,recall_at_k:.5,reciprocal_rank_at_k:.5});
  assert.equal(rankingMetrics([],[],3).recall_at_k,null);assert.equal(rankingMetrics([],['a'],3).reciprocal_rank_at_k,0);
  assert.equal(search('space rescue','bm25','all').evaluation.precision_at_k,2/3);
});
test('invalid settings and malformed catalogs fail clearly',()=>{
  for(const args of [[null],['x','bad'],['x','bm25','bad'],['x','bm25','any','all',0],['x','bm25','any','all',3,NaN]])assert.throws(()=>search(...args));
  const duplicate=structuredClone(dataset);duplicate.movies[1].id='M001';assert.throws(()=>buildIndex(duplicate));
  const invalid=structuredClone(dataset);invalid.queries[0].relevant=['M999'];assert.throws(()=>buildIndex(invalid));
});
