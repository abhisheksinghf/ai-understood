import {useState} from 'react';
import {defaults,evaluate} from '../lib/aiSecurity.mjs';
import '../styles/ai-security.css';
type Config={mode:string;slice:string;context:string;approval:string};
export default function AISecurityLab(){
 const [config,setConfig]=useState<Config>({...defaults}),[selected,setSelected]=useState('A4');
 const r=evaluate(config),chosen=r.rows.find(row=>row.id===selected)||r.rows[0];
 function change(key:keyof Config,value:string){setConfig({...config,[key]:value});}
 function download(){const url=URL.createObjectURL(new Blob([JSON.stringify(r,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='chapter-35-security-report.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <section className="lab ai-security-lab" aria-labelledby="security-title">
 <div className="lab-top"><span className="eyebrow">INSPECT THE BOUNDARY</span><span className="lab-tag">Local fixtures · no real actions</span></div>
 <h3 id="security-title">Same proposal. Different permission checks.</h3><p>Eight authored cases contain fixed proposed actions. Compare an intentionally weak phrase filter with code checks. This runs no model and measures no real attack success rate.</p>
 <div className="screen-only">
 <div className="security-controls">
 <label htmlFor="security-mode">Decision method<select id="security-mode" value={config.mode} onChange={e=>change('mode',e.target.value)}><option value="keyword">One-phrase keyword filter</option><option value="boundaries">Check action boundaries</option></select></label>
 <label htmlFor="security-approval">N2 confirmation from trusted UI<select id="security-approval" value={config.approval} onChange={e=>change('approval',e.target.value)}><option value="matched">Matches request and movie</option><option value="missing">Missing confirmation</option><option value="stale">Approval for an older request</option></select></label>
 <label htmlFor="security-context">Context for public recommendation<select id="security-context" value={config.context} onChange={e=>change('context',e.target.value)}><option value="minimal">Catalog + stated preferences</option><option value="excessive">Also email + viewing history</option></select></label>
 <label htmlFor="security-slice">Display cases<select id="security-slice" value={config.slice} onChange={e=>change('slice',e.target.value)}><option value="all">All eight cases</option><option value="legitimate">Legitimate requests</option><option value="adversarial">Adversarial proposals</option></select></label>
 </div>
 <div className="security-stats" aria-live="polite"><div><span>Full suite · policy violations</span><strong data-security="violations">{r.full.violations}</strong><small>Simulated actions that should not run</small></div><div><span>Full suite · false blocks</span><strong data-security="falseBlocks">{r.full.falseBlocks}</strong><small>Allowed tasks incorrectly stopped</small></div><div><span>Full suite · expected decisions</span><strong data-security="correct">{r.full.correct}/{r.full.total}</strong><small>Eight authored cases only</small></div><div><span>Unnecessary private field types</span><strong data-security="private">{r.unnecessaryPrivateFields}</strong><small>Exposure indicator, not measured leaks</small></div></div>
 <p className="local-note">Metrics above always use all eight cases. Context contains only field names: {r.contextFields.join(', ')}. The context switch does not change the fixed proposals.</p>
 <div className="security-table" role="region" aria-label="Security decisions" tabIndex={0}><table><thead><tr><th>Case</th><th>Decision</th><th>Reason</th></tr></thead><tbody>{r.rows.map(row=><tr key={row.id}><td>{row.id}<small>{row.label}</small></td><td><strong>{row.decision}</strong><small>{row.violation?'Policy violation':row.falseBlock?'False block':'Expected decision'}</small></td><td>{row.reason}</td></tr>)}</tbody></table></div>
 <details className="security-inspector"><summary>Inspect proposal, trusted state, and decision</summary><label htmlFor="security-record">Case<select id="security-record" value={chosen.id} onChange={e=>setSelected(e.target.value)}>{r.rows.map(row=><option key={row.id} value={row.id}>{row.id} · {row.label}</option>)}</select></label><p>{chosen.text}</p><pre>{JSON.stringify(chosen,null,2)}</pre></details>
 <p className="local-note">The model's <code>claimedApproval</code> field never grants permission in the boundary method. Host identity and grants are trusted fixtures; a deployed service must enforce them on the server.</p>
 <div className="workshop-actions"><button className="small-button" onClick={()=>{setConfig({...defaults});setSelected('A4');}}>Reset experiment</button><button className="small-button" onClick={download}>Download security report</button></div>
 </div>
 <div className="print-only"><p><strong>Worked comparison:</strong> eight fixed proposals; N2 has a matching confirmation. Public catalog requests need no confirmation. All effects are simulated.</p><table><thead><tr><th>Full suite</th><th>Keyword filter</th><th>Boundary checks</th></tr></thead><tbody><tr><td>Allowed proposals</td><td>6</td><td>3</td></tr><tr><td>Policy violations</td><td>4</td><td>0</td></tr><tr><td>False blocks</td><td>1</td><td>0</td></tr><tr><td>Expected decisions</td><td>3/8</td><td>8/8</td></tr></tbody></table><p>The filter blocks harmless quoted dialogue but misses cross-account access, export, a changed movie, and old approval. With N2 approval missing, boundaries sends N2 to review; keyword violations rise to 5. Excessive context adds two unnecessary private field types even with zero action violations.</p></div>
 </section>;
}
