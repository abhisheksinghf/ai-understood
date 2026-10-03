import {useState} from 'react';
import {data,defaults,contracts,runWorkflow} from '../lib/workflows.mjs';
import '../styles/workflows.css';
type Config={scenario:string;retries:number;budget:number;canWrite:boolean;authorized:boolean;deduplicate:boolean};
type Entry={step:number;state:string;call_id:string;code:string;detail:string};
export default function WorkflowLab(){
 const [config,setConfig]=useState<Config>({...defaults});
 const report=runWorkflow(config);
 function change(key:keyof Config,value:string|number|boolean){setConfig({...config,[key]:value});}
 function download(){const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='chapter-31-workflow-report.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <section className="lab workflow-lab" aria-labelledby="workflow-title">
  <div className="lab-top"><span className="eyebrow">PROPOSE. CHECK. EXECUTE.</span><span className="lab-tag">Scripted calls · real local state transitions</span></div>
  <h3 id="workflow-title">Same request. Different paths.</h3><p>Follow a fictional movie lookup and watchlist save. Every control change starts a fresh isolated run. No model or real account is connected.</p>
  <div className="screen-only">
   <div className="flow-controls"><label htmlFor="flow-scenario">Scenario<select id="flow-scenario" value={config.scenario} onChange={e=>change('scenario',e.target.value)}>{data.scenarios.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label><label htmlFor="flow-retries">Retries per tool<select id="flow-retries" value={config.retries} onChange={e=>change('retries',+e.target.value)}>{[0,1,2].map(n=><option key={n}>{n}</option>)}</select></label><label htmlFor="flow-budget">Total execution-attempt budget<select id="flow-budget" value={config.budget} onChange={e=>change('budget',+e.target.value)}>{[1,2,3,4].map(n=><option key={n}>{n}</option>)}</select></label></div>
   <div className="flow-toggles"><label><input id="flow-permission" type="checkbox" checked={config.canWrite} onChange={e=>change('canWrite',e.target.checked)}/> Account has write permission</label><label><input id="flow-intent" type="checkbox" checked={config.authorized} onChange={e=>change('authorized',e.target.checked)}/> User authorized the intended movie action</label><label><input id="flow-dedup" type="checkbox" checked={config.deduplicate} onChange={e=>change('deduplicate',e.target.checked)}/> Service deduplicates repeated operation keys</label></div>
   {!config.deduplicate&&<p className="flow-warning">Unsafe teaching mode: the append endpoint ignores the operation key. A lost-response retry can create duplicate rows. Use this to inspect the failure, not as a production retry policy.</p>}
   <div className="flow-status" aria-live="polite"><p>Status: <strong data-flow="status">{report.status}</strong></p><p data-flow="answer">{report.answer}</p><p><strong data-flow="attempts">{report.attempts}</strong> execution {report.attempts===1?'attempt':'attempts'} · <strong data-flow="rows">{report.backendRows.length}</strong> backend {report.backendRows.length===1?'row':'rows'}</p></div>
   <p className="lab-note">The backend row count is a teaching view. After a lost response, the caller still reports an unknown outcome until it receives a valid receipt. Simulated retry delays are logged but no real waiting occurs.</p>
   <ol className="flow-trace" aria-label="Workflow execution trace">{report.trace.map((entry:Entry)=><li key={entry.step} data-state={entry.state}><div><span className="flow-step">{entry.step}</span><strong>{entry.state}</strong><code>{entry.call_id}</code></div><p><b>{entry.code}</b> · {entry.detail}</p></li>)}</ol>
   <details className="workshop-detail"><summary>Inspect contracts and backend rows</summary><p>Account: viewer-1. Application operation key: request-31-save. The key is fixed only inside this isolated demonstration; real operations need appropriately unique keys.</p><pre>{JSON.stringify({contracts,backendRows:report.backendRows},null,2)}</pre></details>
   <div className="workshop-actions"><button className="small-button" onClick={()=>setConfig({...defaults})}>Reset experiment</button><button className="small-button" onClick={download}>Download workflow report</button></div>
  </div>
  <div className="print-only"><p><strong>Worked results: a lost save response.</strong> The fictional service commits the first write, then drops its receipt. Defaults: write permission and user intent present; budget 4.</p><table><thead><tr><th>Configuration</th><th>Attempts</th><th>Backend rows</th><th>Caller outcome</th></tr></thead><tbody><tr><td>1 retry, deduplication on</td><td>3</td><td>1</td><td>Completed; receipt replayed</td></tr><tr><td>1 retry, deduplication off</td><td>3</td><td>2</td><td>Completed; duplicate append</td></tr><tr><td>0 retries, deduplication on</td><td>2</td><td>1</td><td>Unknown; reconcile</td></tr></tbody></table><p>The retry uses the same call ID and operation key. Only the service's deduplication contract prevents another append. Without a returned receipt, the caller cannot infer success from the hidden backend count.</p></div>
  <noscript><p>Enable JavaScript to explore the trace, or use the Python workbook and printed worked results.</p></noscript>
 </section>;
}
