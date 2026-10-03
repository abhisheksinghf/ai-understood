import snapshot from '../../public/downloads/chapter-19-rag-evaluation/benchmark.json' with {type:'json'};
import {experiment as pipeline,validate as validateSources} from './rag-pipeline.mjs';
export const dataset=snapshot;
const ratio=(n,d)=>d?n/d:null;
const mean=values=>{const xs=values.filter(v=>v!==null);return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;};
export function validate(data=dataset){
 if(!data||data.version!=='rag-evaluation-v1'||!Array.isArray(data.cases)||!data.cases.length||!Array.isArray(data.facts)||!Array.isArray(data.configurations)||!data.configurations.length||!data.audit)throw new Error('Invalid benchmark.');
 validateSources(data.source);
 const factIds=new Set(),caseIds=new Set(),configIds=new Set();
 for(const f of data.facts){const m=data.source.movies.find(m=>m.id===f.movie_id);if(!m||typeof f.id!=='string'||factIds.has(f.id)||typeof f.text!=='string'||![m.summary,...(m.runtime_minutes===null?[]:[`Runtime: ${m.runtime_minutes} minutes.`])].includes(f.text))throw new Error('Invalid reference fact.');factIds.add(f.id);}
 for(const q of data.cases){if(!q||typeof q.id!=='string'||caseIds.has(q.id)||typeof q.question!=='string'||!q.question.trim()||typeof q.search!=='string'||!q.search.trim()||!['summary','runtime','streaming'].includes(q.field)||!Array.isArray(q.gold)||new Set(q.gold).size!==q.gold.length||!q.gold.every(id=>factIds.has(id)))throw new Error('Invalid evaluation case.');caseIds.add(q.id);}
 for(const c of data.configurations){if(!c||typeof c.id!=='string'||configIds.has(c.id)||typeof c.label!=='string'||!Number.isInteger(c.k)||c.k<1||c.k>8||!Number.isInteger(c.budget)||c.budget<0||c.budget>1000)throw new Error('Invalid configuration.');configIds.add(c.id);}
 const a=data.audit;if(!Array.isArray(a.sources)||!a.sources.length||!Array.isArray(a.required)||!a.required.length||new Set(a.required).size!==a.required.length||!Array.isArray(a.fixtures)||!a.fixtures.length)throw new Error('Invalid audit.');
 const ids=new Set(a.sources.map(s=>s.id));if(ids.size!==a.sources.length||a.sources.some(s=>typeof s.id!=='string'||typeof s.text!=='string'))throw new Error('Invalid audit sources.');
 const fixtures=new Set();for(const f of a.fixtures){if(!f||typeof f.id!=='string'||fixtures.has(f.id)||!Array.isArray(f.claims))throw new Error('Invalid audit fixture.');fixtures.add(f.id);for(const c of f.claims){if(typeof c.text!=='string'||!Array.isArray(c.citations)||!c.citations.every(id=>typeof id==='string')||new Set(c.citations).size!==c.citations.length||!Array.isArray(c.supported_by)||!c.supported_by.every(id=>ids.has(id))||!Array.isArray(c.covers)||!c.covers.every(id=>a.required.includes(id)))throw new Error('Invalid claim labels.');}}
 return data;
}
export function runCase(queryId='Q1',configId='wide',data=dataset){
 validate(data);const q=data.cases.find(q=>q.id===queryId),cfg=data.configurations.find(c=>c.id===configId);if(!q||!cfg)throw new Error('Unknown case or configuration.');
 // Only public request fields enter the pipeline; reference facts are used afterward.
 const source={...data.source,queries:data.cases.map(({id,question,search,field})=>({id,question,search,field}))};
 const trace=pipeline(q.id,'section',cfg.k,cfg.budget,'all','none',source);
 const found=(chunks,f)=>chunks.some(c=>c.movie_id===f.movie_id&&c.text.includes(f.text));
 const references=data.facts.filter(f=>q.gold.includes(f.id));
 const retrieved=references.filter(f=>found(trace.candidates,f)).map(f=>f.id),packed=references.filter(f=>found(trace.context.selected,f)).map(f=>f.id);
 const claims=trace.validation.evidence.map(e=>({...e,fact_ids:data.facts.filter(f=>f.movie_id===e.movie_id&&f.text===e.quote).map(f=>f.id),supported:trace.context.selected.some(c=>c.id===e.source_id&&c.text.includes(e.quote))}));
 const covered=[...new Set(claims.flatMap(c=>c.fact_ids).filter(id=>q.gold.includes(id)))];
 const answered=claims.length>0,answerable=q.gold.length>0;
 const correctAnswer=answered&&answerable&&covered.length===q.gold.length&&claims.every(c=>c.fact_ids.some(id=>q.gold.includes(id)));
 const success=answerable?correctAnswer:!answered;
 const diagnosis=!answerable?(answered?'Answered despite missing requested fact':'Correct abstention'):retrieved.length<q.gold.length?'Retrieval gap':packed.length<q.gold.length?'Context packing gap':!answered?'Answer step omitted evidence':!correctAnswer?'Wrong fact selected':'Required evidence answered';
 return {id:q.id,question:q.question,answerable,gold:q.gold,configuration:cfg.id,retrieved_facts:retrieved,packed_facts:packed,covered_facts:covered,retrieval_recall:ratio(retrieved.length,q.gold.length),context_recall:ratio(packed.length,q.gold.length),answered,correct_answer:correctAnswer,success,diagnosis,claims,trace};
}
/** @param {ReturnType<typeof runCase>[]} rows */
function summarize(rows){
 const answerable=rows.filter(r=>r.answerable),missing=rows.filter(r=>!r.answerable),answered=rows.filter(r=>r.answered),claims=rows.flatMap(r=>r.claims);
 return {queries:rows.length,answerable:answerable.length,missing:missing.length,answered:answered.length,correct_answers:rows.filter(r=>r.correct_answer).length,successes:rows.filter(r=>r.success).length,task_success:ratio(rows.filter(r=>r.success).length,rows.length),answer_coverage:ratio(answered.length,rows.length),answered_accuracy:ratio(answered.filter(r=>r.correct_answer).length,answered.length),false_answer_rate:ratio(missing.filter(r=>r.answered).length,missing.length),retrieval_recall:mean(answerable.map(r=>r.retrieval_recall)),context_recall:mean(answerable.map(r=>r.context_recall)),quote_support:ratio(claims.filter(c=>c.supported).length,claims.length),mean_evidence_units:mean(rows.map(r=>r.trace.context.used))};
}
export function compare(configId='wide',slice='all',data=dataset){
 validate(data);if(!['all','answerable','missing'].includes(slice))throw new Error('Invalid slice.');
 const ids=data.cases.filter(q=>slice==='all'||(slice==='answerable'?q.gold.length>0:q.gold.length===0)).map(q=>q.id);
 const baseline=ids.map(id=>runCase(id,'narrow',data)),candidate=ids.map(id=>runCase(id,configId,data));
 if(!data.configurations.some(c=>c.id===configId))throw new Error('Unknown configuration.');
 const pairs=candidate.map((c,i)=>({id:c.id,baseline_success:baseline[i].success,candidate_success:c.success,outcome:c.success===baseline[i].success?'tie':c.success?'win':'loss'}));
 const a=summarize(baseline),b=summarize(candidate);
 return {version:data.version,provenance:data.provenance,configuration:configId,slice,baseline:a,candidate:b,paired:{wins:pairs.filter(p=>p.outcome==='win').length,losses:pairs.filter(p=>p.outcome==='loss').length,ties:pairs.filter(p=>p.outcome==='tie').length,delta:a.task_success===null||b.task_success===null?null:b.task_success-a.task_success,pairs},rows:candidate};
}
export function audit(fixtureId='complete',data=dataset){
 validate(data);const a=data.audit,f=a.fixtures.find(f=>f.id===fixtureId);if(!f)throw new Error('Unknown audit fixture.');
 const context=new Set(a.sources.map(s=>s.id)),covered=new Set();
 const claims=f.claims.map(c=>{const supported=c.supported_by.some(id=>context.has(id));if(supported)c.covers.forEach(id=>covered.add(id));return {...c,supported,valid_links:c.citations.filter(id=>context.has(id)).length,supporting_links:c.citations.filter(id=>context.has(id)&&c.supported_by.includes(id)).length};});
 const totalLinks=claims.reduce((s,c)=>s+c.citations.length,0),supportingLinks=claims.reduce((s,c)=>s+c.supporting_links,0);
 return {id:f.id,label:f.label,note:f.note,question:a.question,sources:a.sources,required:a.required,claims,metrics:{context_support:ratio(claims.filter(c=>c.supported).length,claims.length),valid_citation_ids:ratio(claims.reduce((s,c)=>s+c.valid_links,0),totalLinks),citation_precision:ratio(supportingLinks,totalLinks),citation_coverage:ratio(claims.filter(c=>c.supporting_links>0).length,claims.length),required_fact_coverage:ratio(a.required.filter(id=>covered.has(id)).length,a.required.length)},annotation:'Support and required-fact labels are authored judgments. Arithmetic is computed; no semantic judge model is running.'};
}
