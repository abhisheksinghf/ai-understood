import {useMemo,useState} from 'react';
import {data,defaults,evaluate,run} from '../lib/capstone.mjs';
import '../styles/capstone.css';
type Config={constraints:boolean;aliases:boolean;tool:string};
type Panel='trace'|'evaluation'|'gate';
export default function CapstoneLab(){
 const [config,setConfig]=useState<Config>({...defaults}),[panel,setPanel]=useState<Panel>('trace'),[selected,setSelected]=useState('C1');
 const report=useMemo(()=>evaluate(config),[config]);
 const current=data.cases.find(c=>c.id===selected)!;
 const response=useMemo(()=>run(current.request,config),[current,config]);
 function change(key:keyof Config,value:boolean|string){setConfig({...config,[key]:value});}
 function download(){const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='chapter-42-capstone-report.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <section className="lab capstone-lab" aria-labelledby="capstone-title">
 <div className="lab-top"><span className="eyebrow">BUILD · TRACE · EVALUATE</span><span className="lab-tag">Local experiment</span></div>
 <h3 id="capstone-title">One assistant. Inspect every decision.</h3>
 <p>Eight public practice cases, four fictional movies, one controlled tool fixture. Change a component and inspect the result.</p>
 <div className="screen-only">
 <div className="cap-controls">
 <label htmlFor="cap-constraints">Hard constraints<select id="cap-constraints" value={String(config.constraints)} onChange={e=>change('constraints',e.target.value==='true')}><option value="true">On: enforce runtime + watched list</option><option value="false">Off: flawed baseline demo</option></select></label>
 <label htmlFor="cap-aliases">Vocabulary aliases<select id="cap-aliases" value={String(config.aliases)} onChange={e=>change('aliases',e.target.value==='true')}><option value="true">On: cosmic → space</option><option value="false">Off: exact tags only</option></select></label>
 <label htmlFor="cap-tool">Availability fixture<select id="cap-tool" value={config.tool} onChange={e=>change('tool',e.target.value)}><option value="online">Successful local lookup</option><option value="timeout">Simulated timeout</option></select></label>
 </div>
 <div className="cap-stats" aria-live="polite"><div><span>Task cases passed</span><strong data-cap="passed">{report.passed}/{report.total}</strong><small>Public development cases</small></div><div><span>Constraint violations</span><strong data-cap="violations">{report.violations}</strong><small>Checked against the request</small></div><div><span>Demo gate</span><strong data-cap="gate">{report.gate}</strong><small>All eight tasks + critical checks</small></div></div>
 <div className="cap-panels" role="group" aria-label="Capstone experiments">{([['trace','Request trace'],['evaluation','Evaluation cases'],['gate','Release decision']] as const).map(([key,label])=><button type="button" className="small-button" key={key} aria-pressed={panel===key} aria-controls={'cap-panel-'+key} onClick={()=>setPanel(key)}>{label}</button>)}</div>
 <div id="cap-panel-trace" hidden={panel!=='trace'}>
 <label className="cap-case" htmlFor="cap-case">Practice request<select id="cap-case" value={selected} onChange={e=>setSelected(e.target.value)}>{data.cases.map(c=><option key={c.id} value={c.id}>{c.id} · {c.label}</option>)}</select></label>
 <pre className="cap-request" aria-label="Structured request">{JSON.stringify(current.request,null,2)}</pre>
 <div className="cap-answer" aria-live="polite"><span className="eyebrow" data-cap="status">{response.status}</span><p data-cap="answer">{response.answer}</p><small data-cap="sources">Sources: {response.sources.length?response.sources.join(', '):'none'}</small></div>
 <h4>Execution trace</h4><ol className="cap-trace">{response.trace.map((step,i)=><li key={i}>{step}</li>)}</ol>
 {response.candidates.length>0&&<div className="cap-table" role="region" tabIndex={0} aria-label="Candidate scores and eligibility"><table><thead><tr><th>Movie</th><th>Minutes</th><th>Score</th><th>Eligible?</th></tr></thead><tbody>{response.candidates.map(c=><tr key={c.id} data-selected={c.id===response.movie_id}><td>{c.title}<small>{c.id}</small></td><td>{c.minutes}</td><td>{c.score}</td><td>{c.eligible?'Yes':'No'}<small>{c.reasons.join('; ')||'Within constraints'}</small></td></tr>)}</tbody></table></div>}
 </div>
 <div id="cap-panel-evaluation" hidden={panel!=='evaluation'}>
 <p className="cap-insight">The baseline with both safeguards and aliases off passes 4/8 with a successful fixture. This configuration passes <strong>{report.passed}/8</strong>. Inspect the failed cases before changing another component.</p>
 <div className="cap-table" role="region" tabIndex={0} aria-label="Eight development case results"><table><thead><tr><th>Case</th><th>Expected</th><th>Actual</th><th>Result</th></tr></thead><tbody>{report.rows.map(c=><tr key={c.id} data-pass={c.passed}><td>{c.id}<small>{c.label}</small></td><td>{c.expected.status}<small>{c.expected.movie_id||'No selection'}</small></td><td>{c.result.status}<small>{c.result.movie_id||'No selection'}</small></td><td>{c.passed?'Pass':'Fail'}<small>{!c.constraintsOk?'Constraint violation':!c.evidenceOk?'Evidence check failed':c.passed?'Contract satisfied':'Expected outcome not met'}</small></td></tr>)}</tbody></table></div>
 <p className="local-note">For runtime and availability, the report also compares the exact value. Supported outputs require the correct versioned source. These deterministic checks do not evaluate arbitrary LLM prose.</p>
 </div>
 <div id="cap-panel-gate" hidden={panel!=='gate'}>
 <h4>What this gate requires</h4><ul className="cap-gates"><li><span>All eight task contracts pass</span><strong data-cap="quality">{report.passed===8?'Pass':'Fail'}</strong></li><li><span>Zero constraint or evidence failures</span><strong data-cap="integrity">{report.violations===0&&report.evidenceFailures===0?'Pass':'Fail'}</strong></li><li><span>Zero tool timeouts</span><strong data-cap="tools">{report.toolFailures===0?'Pass':'Fail'}</strong></li></ul>
 <p className="cap-insight">{report.gate==='Passes demo gate'?'This configuration passes the authored development checks. Freeze it, then assess separately written evaluation cases before making a broader claim.':'Investigate the failed checks. A timeout fallback avoids fabrication but does not complete the availability task.'}</p>
 <p className="local-note">This is a teaching gate. It does not test a deployed service, a real language model, prompt injection, or unseen users. No release happens when you change these controls.</p>
 </div>
 <div className="workshop-actions"><button type="button" className="small-button" onClick={()=>{setConfig({...defaults});setPanel('trace');setSelected('C1');}}>Reset experiment</button><button type="button" className="small-button" onClick={download}>Download capstone report</button></div>
 <p className="local-note">No API calls. No model training. The browser and Python workbook run the same deterministic workflow. All availability data is fictional.</p>
 </div>
 <div className="print-only"><p><strong>Printable experiment results.</strong> Each configuration uses the same eight public development cases.</p><table><thead><tr><th>Configuration</th><th>Passed</th><th>Violations</th><th>Demo gate</th></tr></thead><tbody><tr><td>Filters off; aliases off</td><td>4/8</td><td>3</td><td>Needs work</td></tr><tr><td>Filters on; aliases off</td><td>7/8</td><td>0</td><td>Needs work</td></tr><tr><td>Both on; successful fixture</td><td>8/8</td><td>0</td><td>Passes</td></tr><tr><td>Both on; tool timeout</td><td>7/8</td><td>0</td><td>Needs work</td></tr></tbody></table><p>For C1, Deep Orbit scores 2 but exceeds the 110-minute limit; Moonlight Map scores 1 and qualifies at 105 minutes. For C6, a timeout returns no availability value or source. Passing the demo gate is not evidence of generalization.</p></div>
 </section>;
}
