import {useState} from 'react';
import {apiCases} from '../data/chapter05';

export default function ApiExplorer(){
  const [caseId,setCaseId]=useState('success');
  const [sent,setSent]=useState(false);
  const selected=apiCases.find(item=>item.id===caseId)!;
  const request='POST /predict\nContent-Type: application/json\n\n'+JSON.stringify({size_mb:selected.size},null,2);
  return <section className="lab api-explorer" aria-labelledby="api-explorer-title">
    <div className="lab-top"><span className="eyebrow">FIND THE FAILED BOUNDARY</span><span className="lab-tag">Local simulation</span></div>
    <h4 id="api-explorer-title">Same task. Different outcomes.</h4>
    <p>Choose a situation and predict your next action. These examples run inside the page; no server is contacted and no credentials are needed.</p>
    <div className="screen-only">
      <div className="training-controls">
        <label htmlFor="api-scenario">Situation <select id="api-scenario" value={caseId} onChange={event=>{setCaseId(event.target.value);setSent(false);}}>{apiCases.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <button className="primary-button" onClick={()=>setSent(true)} disabled={sent}>Send sample request</button>
        <button className="small-button" onClick={()=>setSent(false)}>Reset example</button>
      </div>
      <div className="api-message-grid">
        <div><span className="eyebrow">REQUEST · SIMPLIFIED</span><pre><code>{request}</code></pre></div>
        <div><span className="eyebrow">RESPONSE · SIMULATED</span><pre data-api="response"><code>{sent?selected.status+(selected.id==='limited'?'\nRetry-After: 2':'')+(selected.body?'\n\n'+JSON.stringify(selected.body,null,2):'\nThe wait ended without a response.'):'Send the sample to reveal the outcome.'}</code></pre></div>
      </div>
      <div className="api-diagnosis" role="status" aria-live="polite" aria-atomic="true">
        {sent?<><p><strong data-api="boundary">{selected.boundary}</strong></p><p data-api="action">{selected.action}</p><p><strong>Next attempt:</strong> {selected.retry}</p></>:<p>First decide: does this situation require different input, different access, waiting, or a contract check?</p>}
      </div>
    </div>
    <div className="print-only">
      <p>Example request: POST /predict with JSON body <code>{'{"size_mb": 3}'}</code>. A successful response contains prediction_seconds = 7 and model_version = demo-v1.</p>
      <table><thead><tr><th>Situation</th><th>Outcome</th><th>Reasoned next action</th></tr></thead><tbody>{apiCases.map(item=><tr key={item.id}><td>{item.label}</td><td>{item.status}</td><td>{item.action}</td></tr>)}</tbody></table>
    </div>
    <noscript><p>Enable JavaScript to explore each situation, or use the PDF for the complete comparison.</p></noscript>
  </section>;
}
