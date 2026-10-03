import {useState} from 'react';
import recording from '../data/applicationTrace.json';
type Run = {status:string;attempts:number;prompt_version:string;model:string;candidate:unknown;trace:{stage:string;detail:string}[]};
const stageName=(value:string)=>value.replaceAll('_',' ');
export default function ApplicationTrace(){
  const [caseId,setCaseId]=useState('success');
  const [budget,setBudget]=useState('1');
  const [step,setStep]=useState(0);
  const current=recording.cases.find(item=>item.id===caseId)!;
  const run=(current.runs as Record<string,Run>)[budget];
  const event=run.trace[step];
  const finished=step===run.trace.length-1;
  const calls=run.trace.slice(0,step+1).filter(item=>item.stage==='provider_call').length;
  const download=()=>{
    const blob=new Blob([JSON.stringify({notice:recording.notice,case:caseId,totalAttemptBudget:Number(budget),...run},null,2)+'\n'],{type:'application/json'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`chapter-10-${caseId}-${budget}-attempt-trace.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  return <section className="lab application-trace" aria-label="Python application trace explorer">
    <div className="lab-top"><span className="eyebrow">FOLLOW THE CODE'S DECISIONS</span><span className="lab-tag">Recorded Python · fixture responses</span></div>
    <h3>One workflow. Different outcomes.</h3>
    <p>Replay real Python control flow with authored service responses. No model runs here; offline retry waits were skipped.</p>
    <div className="screen-only">
      <div className="training-controls">
        <label htmlFor="app-case">Prepared case<select id="app-case" value={caseId} onChange={e=>{setCaseId(e.target.value);setStep(0);}}>{recording.cases.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label htmlFor="app-budget">Total attempt budget<select id="app-budget" value={budget} onChange={e=>{setBudget(e.target.value);setStep(0);}}><option value="1">1 attempt · no retry</option><option value="2">2 attempts · at most 1 retry</option></select></label>
      </div>
      <div className="app-trace-event" aria-live="polite" aria-atomic="true">
        <span className="eyebrow" data-app="step">EVENT {step+1} OF {run.trace.length} · {calls} PROVIDER CALL{calls===1?'':'S'} SO FAR</span>
        <h4 data-app="stage">{stageName(event.stage)}</h4>
        <p data-app="detail">{event.detail}</p>
        {finished&&<p data-app="outcome"><strong>Final status: <code>{run.status}</code></strong> · {run.attempts} total attempt{run.attempts===1?'':'s'}.</p>}
      </div>
      <div className="workshop-actions">
        <button className="small-button" disabled={step===0} onClick={()=>setStep(step-1)}>Previous event</button>
        <button className="primary-button" disabled={finished} onClick={()=>setStep(step+1)}>Next event →</button>
        <button className="small-button" disabled={finished} onClick={()=>setStep(run.trace.length-1)}>Jump to outcome</button>
        <button className="text-button" onClick={()=>setStep(0)}>Restart trace</button>
      </div>
      {finished&&<div className="app-trace-outcome"><p data-app="lesson">{current.lesson}</p>{run.candidate!==null?<details className="workshop-detail"><summary>Inspect the authored candidate</summary><pre data-app="candidate">{JSON.stringify(run.candidate,null,2)}</pre><p>This candidate is fixture data. Check every claim against its source; the app has not verified its meaning.</p></details>:<p data-app="no-candidate">No candidate accepted.</p>}</div>}
      <details className="workshop-detail"><summary>Inspect the fictional source records</summary><p>The empty-input case supplies no records. All other cases use these same records.</p><ul>{recording.sources.map(source=><li key={source.id}><strong>{source.id}:</strong> {source.text}</li>)}</ul></details>
      <details className="workshop-detail"><summary>Inspect the full recorded trace</summary><ol className="app-event-list">{run.trace.map((item,i)=><li key={i}><strong>{stageName(item.stage)}:</strong> {item.detail}</li>)}</ol><button className="small-button" onClick={download}>Download this trace</button></details>
    </div>
    <div className="print-only"><p>Recorded outcomes from the Python workbook; two total attempts are allowed below. The first case also passes with one attempt. Temporary failure stops after one attempt, but reaches review_required with two.</p><table><thead><tr><th>Prepared case</th><th>Final status</th><th>Calls</th></tr></thead><tbody>{recording.cases.map(item=><tr key={item.id}><td>{item.label}</td><td>{item.runs['2'].status}</td><td>{item.runs['2'].attempts}</td></tr>)}</tbody></table><p><strong>Key comparison:</strong> the unsupported-claim case still reaches review_required. A false claim can pass types and source-ID checks. The empty source list stops before any provider call.</p></div>
    <noscript><p>Enable JavaScript for trace controls, or use the PDF and downloadable Python workbook.</p></noscript>
  </section>;
}
