import test from 'node:test';
import assert from 'node:assert/strict';
import {dataset,compare,runCase,audit} from '../src/lib/rag-evaluation.mjs';
test('paired comparison agrees with independently counted wins, losses, and denominators',()=>{
 const r=compare();assert.equal(r.baseline.successes,5);assert.equal(r.candidate.successes,7);assert.equal(r.candidate.task_success,7/8);assert.equal(r.candidate.answer_coverage,7/8);assert.equal(r.candidate.answered_accuracy,6/7);assert.equal(r.candidate.false_answer_rate,1/2);assert.equal(r.paired.wins,3);assert.equal(r.paired.losses,1);assert.equal(r.paired.ties,4);assert.equal(r.paired.delta,1/4);assert.equal(r.candidate.mean_evidence_units,39.75);
 const missing=compare('wide','missing');assert.equal(missing.candidate.queries,2);assert.equal(missing.candidate.task_success,.5);assert.equal(missing.candidate.answered_accuracy,0);assert.equal(missing.candidate.retrieval_recall,null);assert.equal(missing.paired.losses,1);
});
test('real quoted evidence can be a wrong answer and packing can lose retrieved facts',()=>{
 const q=runCase('Q5');assert.equal(q.success,false);assert.equal(q.claims[0].quote,'Runtime: 105 minutes.');assert.equal(q.claims[0].movie_id,'M001');assert.equal(q.claims[0].supported,true);
 const narrow=runCase('Q1','narrow'),tight=runCase('Q1','tight');assert.equal(narrow.diagnosis,'Retrieval gap');assert.equal(tight.diagnosis,'Context packing gap');assert.equal(tight.retrieval_recall,1);assert.equal(tight.context_recall,0);
 const r=compare('tight');assert.equal(r.candidate.retrieval_recall,1);assert.equal(r.candidate.context_recall,.5);assert.equal(r.candidate.task_success,.625);
});
test('reference judgments cannot alter retrieval, context, or generation',()=>{
 const changed=structuredClone(dataset);changed.cases[0].gold=['M006:summary'];
 assert.deepEqual(runCase('Q1','wide',changed).trace,runCase('Q1','wide').trace);assert.equal(runCase('Q1','wide',changed).success,false);
 const reordered=structuredClone(dataset);reordered.cases.reverse();assert.deepEqual(compare('wide','all',reordered).candidate,compare().candidate);
});
test('zero-answer and empty-slice denominators stay undefined',()=>{
 const changed=structuredClone(dataset);changed.configurations.find(c=>c.id==='wide').budget=0;
 const r=compare('wide','all',changed);assert.equal(r.candidate.task_success,2/8);assert.equal(r.candidate.quote_support,null);assert.equal(r.candidate.answered_accuracy,null);assert.equal(r.candidate.answer_coverage,0);
 changed.cases=changed.cases.filter(q=>q.gold.length);const empty=compare('wide','missing',changed);assert.equal(empty.candidate.queries,0);assert.equal(empty.candidate.task_success,null);assert.equal(empty.paired.delta,null);
});
test('citation support, coverage, and completeness remain distinct',()=>{
 assert.equal(audit('complete').metrics.required_fact_coverage,1);
 assert.equal(audit('partial').metrics.required_fact_coverage,.5);
 const wrong=audit('wrong_citation');assert.equal(wrong.metrics.context_support,1);assert.equal(wrong.metrics.valid_citation_ids,1);assert.equal(wrong.metrics.citation_precision,0);
 const uncited=audit('uncited');assert.equal(uncited.metrics.citation_precision,null);assert.equal(uncited.metrics.citation_coverage,0);
 const movie=audit('wrong_movie');assert.equal(movie.metrics.citation_precision,1);assert.equal(movie.metrics.required_fact_coverage,0);
 assert.equal(audit('fabricated').metrics.context_support,0);
 const changed=structuredClone(dataset);changed.audit.fixtures[0].claims=[];assert.equal(audit('complete',changed).metrics.context_support,null);assert.equal(audit('complete',changed).metrics.required_fact_coverage,0);
});
test('invalid settings and inconsistent benchmark labels fail',()=>{
 assert.throws(()=>compare('bad'));assert.throws(()=>compare('wide','bad'));assert.throws(()=>runCase('Q99'));assert.throws(()=>audit('bad'));
 for(const mutate of [d=>d.cases[0].gold=['absent'],d=>d.cases.push(d.cases[0]),d=>d.configurations[0].budget=-1,d=>d.facts[0].text='Invented fact',d=>d.audit.fixtures[0].claims[0].supported_by=['missing']]){const d=structuredClone(dataset);mutate(d);assert.throws(()=>compare('wide','all',d));}
});
