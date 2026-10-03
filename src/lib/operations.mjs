import fixtures from '../../public/downloads/chapter-36-operations/data.json' with {type:'json'};
export const data=fixtures;
export const defaults={scenario:'bad_release',share:20,retries:1,deadline:2400,rollback:'automatic'};
const choices={scenario:['healthy','bad_release','provider_fault'],share:[0,20,60,100],retries:[0,1],deadline:[1200,2400],rollback:['automatic','observe']};
export function normalize(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!Object.hasOwn(choices,k)))throw new Error('Unknown configuration');
 const c={...defaults,...input};for(const [k,values]of Object.entries(choices))if(!values.includes(c[k]))throw new Error('Invalid '+k);return c;
}
export function runRequest(request,version,config){
 if(!Object.hasOwn(data.versions,version))throw new Error('Unknown version');
 const spec=data.versions[version],attempts=[];let elapsed=0,cost=0,status=503,quality=false,reason='provider_error';
 for(let attempt=1;attempt<=config.retries+1;attempt++){
  if(attempt>1){if(elapsed+data.backoffMs>=config.deadline){reason='retry_budget_exhausted';break;}elapsed+=data.backoffMs;}
  const fault=config.scenario==='provider_fault'&&(request.slot===3||(request.slot===1&&attempt===1));
  const duration=fault?data.faultDurationMs:spec.durationMs,units=fault?data.faultCostUnits:spec.costUnits;
  const remaining=config.deadline-elapsed,used=Math.min(duration,remaining),timedOut=duration>remaining;
  elapsed+=used;cost+=units;status=timedOut?504:fault?503:200;
  quality=status===200&&!(config.scenario==='bad_release'&&version==='candidate'&&[1,3].includes(request.slot));
  reason=timedOut?'deadline_exceeded':status===503?'provider_error':quality?'good':'wrong_recommendation';
  attempts.push({attempt,status,durationMs:used,costUnits:units,quality});
  if(status!==503)break;
 }
 return {id:request.id,window:request.window,slot:request.slot,version,status,quality,good:status===200&&quality&&elapsed<=config.deadline,elapsedMs:elapsed,costUnits:cost,reason,attempts};
}
export function summarize(rows){
 const n=rows.length,good=rows.filter(r=>r.good).length,sorted=rows.map(r=>r.elapsedMs).sort((a,b)=>a-b);
 return {n,good,bad:n-good,goodPercent:n?100*good/n:null,httpOk:rows.filter(r=>r.status===200).length,candidate:rows.filter(r=>r.version==='candidate').length,attempts:rows.reduce((s,r)=>s+r.attempts.length,0),costUnits:rows.reduce((s,r)=>s+r.costUnits,0),p95:n?sorted[Math.ceil(.95*n)-1]:null};
}
export function evaluate(input={}){
 const config=normalize(input),rows=[],windows=[];let rolledBack=false,rollbackAfter=null;
 for(let w=1;w<=4;w++){
  const batch=data.requests.filter(r=>r.window===w).map(request=>runRequest(request,!rolledBack&&request.slot<=config.share/20?'candidate':'baseline',config));
  rows.push(...batch);const canary=batch.filter(r=>r.version==='candidate'),failed=canary.some(r=>!r.good);
  const action=failed?(config.rollback==='automatic'?'rollback_next_window':'review_needed'):canary.length?'observe':'baseline_only';
  if(failed&&config.rollback==='automatic'&&!rolledBack){rolledBack=true;rollbackAfter=w;}
  windows.push({window:w,...summarize(batch),candidateBad:canary.filter(r=>!r.good).length,action});
 }
 const totals=summarize(rows),allowedBad=totals.n*(100-data.sloPercent)/100;
 return {config,totals,allowedBad,budgetRemaining:allowedBad-totals.bad,sloMet:totals.goodPercent>=data.sloPercent,rollbackAfter,decision:rolledBack?'rolled_back':windows.some(w=>w.action==='review_needed')?'review_needed':config.share===0?'baseline_only':'observe_more',windows,rows};
}
