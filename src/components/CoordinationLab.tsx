import {useState} from 'react';
import {data,defaults,runCoordination,protocolTranscript} from '../lib/coordination.mjs';
import '../styles/coordination.css';
type Config={scenario:string;pattern:string;schedule:string;budget:number;validate:boolean};
export default function CoordinationLab(){
 const [config,setConfig]=useState<Config>({...defaults});
 const r=runCoordination(config);
 function change(k:keyof Config,v:string|number|boolean){setConfig({...config,[k]:v});}
 function download(){const url=URL.createObjectURL(new Blob([JSON.stringify(r,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='chapter-33-coordination-report.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <section className="lab coordination-lab" aria-labelledby="coordination-title">
 <div className="lab-top"><span className="eyebrow">CONNECT. DELEGATE. VERIFY.</span><span className="lab-tag">Local simulation · fictional timings</span></div>
 <h3 id="coordination-title">Same task. Different coordination.</h3><p>Catalog search supplies two candidates. Availability and taste workers inspect them; the final owner checks the result. Worker roles use fixed code, not LLM calls.</p>
 <div className="screen-only">
 <div className="coordination-controls">
 <label htmlFor="coord-scenario">Evidence scenario<select id="coord-scenario" value={config.scenario} onChange={e=>change('scenario',e.target.value)}>{data.scenarios.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
 <label htmlFor="coord-pattern">Who owns the final reply?<select id="coord-pattern" value={config.pattern} onChange={e=>change('pattern',e.target.value)}><option value="manager">Manager keeps ownership</option><option value="handoff">Handoff to movie specialist</option></select></label>
 <label htmlFor="coord-schedule">After catalog search<select id="coord-schedule" value={config.schedule} onChange={e=>change('schedule',e.target.value)}><option value="parallel">Check availability and taste in parallel</option><option value="sequential">Run the checks sequentially</option></select></label>
 <label htmlFor="coord-budget">Maximum specialist jobs<select id="coord-budget" value={config.budget} onChange={e=>change('budget',+e.target.value)}>{[1,2,3].map(n=><option key={n}>{n}</option>)}</select></label>
 </div><label className="coordination-toggle"><input id="coord-validate" type="checkbox" checked={config.validate} onChange={e=>change('validate',e.target.checked)}/>Verify movie, region, snapshot and conflicting availability before accepting a recommendation.</label>
 <div className="coordination-status" role="status" aria-live="polite"><p><strong data-coord="status">{r.status}</strong> · Final owner: <span data-coord="owner">{r.owner}</span></p><p data-coord="answer">{r.answer}</p><p><span data-coord="jobs">{r.jobCount}</span> specialist jobs · <span data-coord="elapsed">{r.elapsed}</span> simulated time units · <span data-coord="work">{r.workUnits}</span> total work units</p>{r.notes.map(n=><p key={n}>{n}</p>)}</div>
 <div className="coordination-timeline" aria-label="Simulated work timeline">{r.jobs.map(j=><div key={j.worker}><span>{j.worker}</span><div className="coordination-track"><span style={{marginLeft:`${j.start*10}%`,width:`${(j.end-j.start)*10}%`}}>{j.start}–{j.end}</span></div></div>)}<div><span>final reply</span><div className="coordination-track"><span style={{marginLeft:`${(r.elapsed-1)*10}%`,width:'10%'}}>{r.elapsed-1}–{r.elapsed}</span></div></div></div>
 <p className="local-note">Bars show a calculated schedule, not live execution. Handoff overhead is omitted. The teaching evaluator labels unchecked bad answers “unsupported”; that label is not knowledge the unchecked coordinator earned.</p>
 <details><summary>Inspect specialist reports</summary><pre>{JSON.stringify(r.reports,null,2)}</pre></details>
 <details><summary>Inspect a separate MCP message example</summary><p>This fixed seven-message transcript shows one successful tool connection using revision 2025-11-25. It is illustrative and does not change with the controls above. No server is connected.</p><pre>{JSON.stringify(protocolTranscript(),null,2)}</pre></details>
 <div className="workshop-actions"><button className="small-button" onClick={()=>setConfig({...defaults})}>Reset experiment</button><button className="small-button" onClick={download}>Download coordination report</button></div>
 </div>
 <div className="print-only"><p><strong>Worked comparison.</strong> Search takes 2 units; availability takes 3; taste takes 2; final checks take 1. Both checks need the search results first.</p><table><thead><tr><th>Configuration</th><th>Outcome</th></tr></thead><tbody><tr><td>Parallel, matching evidence</td><td>6 time units; 8 work units. Harbor Lights verified.</td></tr><tr><td>Sequential, matching evidence</td><td>8 time units; 8 work units. Same recommendation.</td></tr><tr><td>Wrong region, checks on</td><td>insufficient_evidence: US availability cannot verify India.</td></tr><tr><td>Wrong region, checks off</td><td>unsupported: a plausible recommendation lacks the required evidence.</td></tr></tbody></table><p>Manager mode keeps reply ownership. Handoff transfers it to the movie specialist. With a two-job budget, the taste check is missing and the run is incomplete.</p></div>
 </section>;
}
