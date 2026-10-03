import {useState} from 'react';
import {data,plan,assess} from '../lib/adaptation.mjs';
import '../styles/adaptation.css';
type Config={knowledge:string;writeAction:boolean;behaviorGap:boolean;baselineTested:boolean;examplesReady:boolean;evalReady:boolean};
type Design={rag:boolean;readTool:boolean;writeTool:boolean;fineTune:boolean};
type Flag=Exclude<keyof Config,'knowledge'>;
const keys: (keyof Design)[]=['rag','readTool','writeTool','fineTune'];
const flags: Flag[]=['writeAction','behaviorGap','baselineTested','examplesReady','evalReady'];
const empty:Design={rag:false,readTool:false,writeTool:false,fineTune:false};
const initial=data.scenarios[5];
export default function AdaptationLab(){
 const [view,setView]=useState(1),[scenario,setScenario]=useState(initial.id),[config,setConfig]=useState<Config>({...initial.config}),[design,setDesign]=useState<Design>({...empty});
 const p=plan(config),a=assess(config,design);
 const label=(key:string)=>data.methods[key as keyof typeof data.methods];
 function select(id:string){const s=data.scenarios.find(s=>s.id===id)!;setScenario(id);setConfig({...s.config});setDesign({...empty});}
 function edit(key:keyof Config,value:string|boolean){setScenario('custom');setConfig(c=>({...c,[key]:value}));}
 function download(){const blob=new Blob([JSON.stringify({plan:p,assessment:a},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='chapter-27-adaptation-report.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <section className="lab adaptation-lab" aria-labelledby="adapt-title">
  <div className="lab-heading"><span className="eyebrow">DECISION WORKSHOP</span><h3 id="adapt-title">One request. Different missing pieces.</h3><p>Choose requirements, inspect the rules, then test a proposed design.</p></div>
  <div className="screen-only">
   <p className="lab-note">A deterministic teaching checklist. No model, search, training, API call, or watchlist action runs here. Coverage is not a quality score.</p>
   <div className="adapt-tabs" aria-label="Workshop views"><button className="small-button" aria-pressed={view===1} onClick={()=>setView(1)}>1 · Diagnose the request</button><button className="small-button" aria-pressed={view===2} onClick={()=>setView(2)}>2 · Test your design</button></div>
   <label className="adapt-select" htmlFor="adapt-scenario">Movie scenario<select id="adapt-scenario" value={scenario} onChange={e=>select(e.target.value)}>{scenario==='custom'&&<option value="custom">Custom requirements</option>}{data.scenarios.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
   <p className="lab-note" data-adapt="description">{data.scenarios.find(s=>s.id===scenario)?.description||'Your edited requirements. Interpret the plan against the assumptions below.'}</p>
   <div hidden={view!==1}>
    <label className="adapt-select" htmlFor="adapt-knowledge">Where must the facts come from?<select id="adapt-knowledge" value={config.knowledge} onChange={e=>edit('knowledge',e.target.value)}>{data.knowledge.map(k=><option key={k.id} value={k.id}>{k.label}</option>)}</select></label>
    <fieldset className="adapt-options"><legend>Behavior, actions, and evidence</legend>{flags.map(k=><label key={k}><input id={'adapt-'+k} type="checkbox" checked={config[k]} onChange={e=>edit(k,e.target.checked)}/><span>{data.flags[k]}</span></label>)}</fieldset>
    <div className="adapt-result" aria-live="polite"><p><strong>Suggested starting design</strong></p><p data-adapt="methods">{p.methods.map(label).join(' + ')}</p><p>Fine-tuning: <strong data-adapt="readiness">{p.fineTuning.status}</strong></p>{p.fineTuning.missing.length>0&&<p>Still needed: {p.fineTuning.missing.map((k:string)=>data.flags[k as Flag]).join('; ')}.</p>}<p className="lab-note">“Trial candidate” means compare a trained candidate with the baseline. It is not a requirement to train or a prediction of improvement.</p></div>
    <details className="workshop-detail"><summary>Inspect the decision rules and assumptions</summary><ol><li>A prompt is always present. Supplied facts need no separate knowledge service.</li><li>A large document archive adds RAG; a current service adds a read tool. An authorized state change adds a write tool.</li><li>Only a repeated behavior gap plus an evaluated baseline, curated demonstrations, and held-out evaluation makes fine-tuning a trial candidate.</li><li>These are application roles. A retrieval service can itself be exposed as a tool. A fresh, authoritative index may replace a separate live lookup in other systems.</li><li>Coverage assumes components will be implemented correctly. It cannot prove retrieval quality, permissions, or correct answers.</li></ol></details>
   </div>
   <div hidden={view!==2}>
    <fieldset className="adapt-options"><legend>Your proposed components</legend><p className="lab-note">Prompt baseline is always included.</p>{keys.map(k=><label key={k}><input id={'design-'+k} type="checkbox" checked={design[k]} onChange={e=>setDesign(d=>({...d,[k]:e.target.checked}))}/><span>{label(k)}</span></label>)}</fieldset>
    <button className="small-button" onClick={()=>setDesign({...p.suggestedDesign})}>Use suggested design</button>
    <div className="adapt-result" aria-live="polite"><p><strong data-adapt="verdict">{a.verdict}</strong></p><p>Required external capabilities still missing: <strong data-adapt="missing">{a.missing.length?a.missing.map(label).join(', '):'None'}</strong>.</p>{a.adaptationIssue&&<p>Fine-tuning evidence is incomplete or no repeated behavior gap is identified. Revisit that choice.</p>}{a.extras.length>0&&<p>Components without a stated justification: {a.extras.map(label).join(', ')}. Explain the additional need or simplify.</p>}<p className="lab-note">Quality remains unmeasured. Omitting fine-tuning does not fail this capability check; a behavior gap still needs evaluation and resolution.</p></div>
    <div className="adapt-table"><table><thead><tr><th>Required role</th><th>Included?</th></tr></thead><tbody>{a.requirements.map((r:{id:string;label:string;covered:boolean})=><tr key={r.id}><td>{r.label}</td><td data-role={r.id}>{r.covered?'Yes':'Missing'}</td></tr>)}</tbody></table></div>
   </div>
   <details className="workshop-detail"><summary>What must a real implementation check?</summary><ul>{p.checks.map((c:string)=><li key={c}>{c}</li>)}</ul></details>
   <div className="workshop-actions"><button className="small-button" onClick={download}>Download decision report</button><button className="small-button" onClick={()=>{select(initial.id);setView(1)}}>Reset experiment</button></div>
  </div>
  <div className="print-only"><p><strong>Printable worked example:</strong> the hybrid request needs archive evidence, current availability, an authorized watchlist write, and improved stable behavior. All three training prerequisites are ready.</p><table><thead><tr><th>Design</th><th>Checklist result</th></tr></thead><tbody><tr><td>Prompt + fine-tuning only</td><td>Missing archive retrieval, live lookup, and write execution.</td></tr><tr><td>Prompt + RAG + read and write tools</td><td>Inputs and actions covered; behavior quality still requires evaluation.</td></tr><tr><td>Add a fine-tuning trial</td><td>Trial candidate. Keep it only if held-out results justify it.</td></tr></tbody></table><p>Remove the curated demonstrations: the trial status becomes “Prepare evidence”. Changing model weights never substitutes for executing the watchlist write.</p></div>
 </section>;
}
