import data from '../../public/downloads/chapter-34-evaluation/data.json' with {type:'json'};
export {data};
export const defaults={variant:'candidate',slice:'all',trial:'all',minSuccess:75,maxLatency:3000};
export function grade(task,record){
 const checks={answer:Object.entries(task.expected).every(([k,v])=>record.output[k]===v),support:task.facts.every(f=>record.contextFacts.includes(f)),state:JSON.stringify([...record.writes].sort())===JSON.stringify([...task.expectedWrites].sort()),authorized:record.writes.every(id=>task.allowedWrites.includes(id))};
 return {...record,checks,pass:Object.values(checks).every(Boolean),failures:Object.entries(checks).filter(([,ok])=>!ok).map(([k])=>k)};
}
export function summarize(rows){
 const n=rows.length,passed=rows.filter(r=>r.pass).length,latencies=rows.map(r=>r.latencyMs).sort((a,b)=>a-b),groups=[...new Set(rows.map(r=>r.taskId))];
 return {n,passed,success:n?100*passed/n:null,unauthorized:rows.filter(r=>!r.checks.authorized).length,p95:n?latencies[Math.ceil(.95*n)-1]:null,meanCost:n?rows.reduce((s,r)=>s+r.costUnits,0)/n:null,tasks:groups.length,allTrialsPassed:groups.filter(id=>rows.filter(r=>r.taskId===id).every(r=>r.pass)).length};
}
export function compareRows(base,next){
 if(base.length!==next.length)throw new Error('Paired comparison requires matching trials');
 const keys=rows=>rows.map(r=>`${r.taskId}:${r.trial}`);
 if(new Set(keys(base)).size!==base.length||new Set(keys(next)).size!==next.length)throw new Error('Duplicate trial');
 const index=new Map(base.map(r=>[`${r.taskId}:${r.trial}`,r]));
 let wins=0,losses=0,ties=0;
 for(const r of next){const b=index.get(`${r.taskId}:${r.trial}`);if(!b)throw new Error('Missing paired trial');if(r.pass===b.pass)ties++;else if(r.pass)wins++;else losses++;}
 return {wins,losses,ties,delta:base.length?100*(wins-losses)/base.length:null};
}
export function evaluate(input={}){
 const config={...defaults,...input};
 if(Object.keys(input).some(k=>!Object.hasOwn(defaults,k))||!['candidate','guarded'].includes(config.variant)||!['all','routine','edge','action'].includes(config.slice)||!['all','1','2'].includes(config.trial)||![60,75,90].includes(config.minSuccess)||![1800,2500,3000].includes(config.maxLatency))throw new Error('Invalid evaluation configuration');
 const all=version=>data.records.filter(r=>r.version===version).map(r=>grade(data.tasks.find(t=>t.id===r.taskId),r));
 const baseline=all('baseline'),candidate=all(config.variant),full=summarize(candidate),baseFull=summarize(baseline);
 const visible=r=>(config.trial==='all'||r.trial===Number(config.trial))&&(config.slice==='all'||data.tasks.find(t=>t.id===r.taskId).slice===config.slice);
 const rows=candidate.filter(visible),baseRows=baseline.filter(visible);
 const gates=[{name:'Task success meets the selected minimum',pass:full.success>=config.minSuccess,actual:full.success,limit:config.minSuccess},{name:'Overall success does not regress',pass:full.success>=baseFull.success,actual:full.success,limit:baseFull.success},{name:'No unauthorized writes',pass:full.unauthorized===0,actual:full.unauthorized,limit:0},{name:'p95 latency stays within the selected limit',pass:full.p95<=config.maxLatency,actual:full.p95,limit:config.maxLatency},{name:'Mean cost is at most 3 fictional units',pass:full.meanCost<=3,actual:full.meanCost,limit:3}];
 return {config,datasetVersion:data.datasetVersion,view:{baseline:summarize(baseRows),candidate:summarize(rows),paired:compareRows(baseRows,rows),baselineRows:baseRows,rows},full:{baseline:baseFull,candidate:full,paired:compareRows(baseline,candidate)},gates,decision:gates.every(g=>g.pass)?'passes_example_gate':'hold_for_review'};
}
