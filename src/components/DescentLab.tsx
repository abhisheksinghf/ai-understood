import {useId,useState} from 'react';
import {bowlLoss,descentTrace,descentRates,MAX_DESCENT_STEPS} from '../lib/optimization.mjs';
const fmt=(n:number)=>n!==0&&Math.abs(n)<.0001?n.toExponential(3):Number(n.toFixed(6)).toString();
export default function DescentLab(){
  const [start,setStart]=useState(0),[rate,setRate]=useState(.5),[steps,setSteps]=useState(0);
  const trace=descentTrace(start,rate,steps),current=trace[trace.length-1],previous=trace[trace.length-2];
  const id='descent-'+useId().replace(/[^a-zA-Z0-9]/g,'');
  const low=Math.min(0,...trace.map(r=>r.w))-.5,high=Math.max(6,...trace.map(r=>r.w))+.5;
  const top=Math.max(bowlLoss(low),bowlLoss(high))*1.12;
  const px=(x:number)=>62+(x-low)/(high-low)*595,py=(y:number)=>262-y/top*226;
  const curve=Array.from({length:121},(_,i)=>{const x=low+(high-low)*i/120;return (i?'L':'M')+px(x)+','+py(bowlLoss(x));}).join(' ');
  const path=trace.map((r,i)=>(i?'L':'M')+px(r.w)+','+py(r.loss)).join(' ');
  const behavior=current.gradient===0?'At the minimum: the gradient is zero.':rate===2?'This rate alternates without reducing loss.':rate>2?'This rate increases the distance from the minimum.':rate>1?'The iterates alternate sides while approaching the minimum.':'This rate moves toward the minimum.';
  return <section className="lab descent-lab" aria-labelledby="descent-lab-title">
    <div className="lab-top"><span className="eyebrow">ONE UPDATE AT A TIME</span><span className="lab-tag">Live gradient descent</span></div>
    <h4 id="descent-lab-title">Same curve. Different step sizes.</h4>
    <p>Minimize L(w) = (w − 3)²/2 with derivative w − 3. These are real updates on a dimensionless teaching function, not a trained application model.</p>
    <div className="screen-only">
      <div className="training-controls"><label htmlFor="descent-rate">Learning rate η<select id="descent-rate" value={rate} onChange={e=>{setRate(Number(e.target.value));setSteps(0);}}>{descentRates.map(r=><option value={r} key={r}>{r}</option>)}</select></label>
      <label className="descent-start" htmlFor="descent-start">Starting weight: <strong>{start}</strong><input id="descent-start" type="range" min="-2" max="6" step="0.5" value={start} onChange={e=>{setStart(Number(e.target.value));setSteps(0);}}/></label></div>
      <div className="descent-actions"><button className="primary-button" disabled={steps>=MAX_DESCENT_STEPS} onClick={()=>setSteps(s=>Math.min(s+1,MAX_DESCENT_STEPS))}>Take one step</button><button className="small-button" disabled={steps>=MAX_DESCENT_STEPS} onClick={()=>setSteps(s=>Math.min(s+5,MAX_DESCENT_STEPS))}>Run 5 steps</button><button className="small-button" onClick={()=>setSteps(0)}>Reset steps</button></div>
      <div className="lab-metrics descent-metrics" role="status" aria-live="polite" aria-atomic="true"><div><strong data-descent="step">{steps}</strong><span>Updates</span></div><div><strong data-descent="weight">{fmt(current.w)}</strong><span>Current weight w</span></div><div><strong data-descent="loss">{fmt(current.loss)}</strong><span>Current loss</span></div><div><strong data-descent="gradient">{fmt(current.gradient)}</strong><span>Current gradient</span></div></div>
      <figure className="descent-figure"><div className="descent-plot-scroll" role="region" tabIndex={0} aria-label="Loss curve and visited weights"><svg viewBox="0 0 700 325" role="img" aria-labelledby={id+'-title '+id+'-desc'}>
        <title id={id+'-title'}>Gradient descent on a quadratic loss</title><desc id={id+'-desc'}>{`Step ${steps}: weight ${fmt(current.w)}, loss ${fmt(current.loss)}. The curve has a global minimum at weight 3 and loss zero. Axes rescale to include the visited weights.`}</desc>
        {[0,.5,1].map(f=><g key={f}><line x1="62" x2="657" y1={py(top*f)} y2={py(top*f)} className="plot-grid"/><text x="52" y={py(top*f)+4} textAnchor="end" className="plot-tick">{Number((top*f).toPrecision(3))}</text></g>)}
        <line x1="62" x2="657" y1="262" y2="262" className="plot-axis"/><line x1="62" x2="62" y1="25" y2="262" className="plot-axis"/>
        {[0,.25,.5,.75,1].map(f=>{const x=low+(high-low)*f;return <text key={f} x={px(x)} y="280" textAnchor="middle" className="plot-tick">{Number(x.toFixed(2))}</text>;})}
        <text x="62" y="17" className="plot-label">Loss L(w)</text><text x="358" y="311" textAnchor="middle" className="plot-label">Weight w (dimensionless)</text>
        <path d={curve} fill="none" stroke="var(--accent)" strokeWidth="2.5"/><path d={path} fill="none" stroke="var(--gold)" strokeWidth="2" strokeDasharray="6 4"/>
        {trace.map(r=><circle key={r.step} cx={px(r.w)} cy={py(r.loss)} r="3.5" fill="var(--gold)"/>)}
        <circle cx={px(3)} cy={py(0)} r="5" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2"/>
        <rect x={px(current.w)-5} y={py(current.loss)-5} width="10" height="10" fill="var(--ink)" stroke="var(--surface)" strokeWidth="1.5"/>
      </svg></div><figcaption>Green curve = objective; gold dots and dashed segments = visited steps; square = current step; outlined circle = minimum at w = 3. Axes rescale. Overlapping points represent revisits or very small updates.</figcaption></figure>
      <p data-descent="working" className="descent-working">{previous?`Last update: ${fmt(previous.w)} − ${rate} × (${fmt(previous.gradient)}) = ${fmt(current.w)}.`:'Choose a rate and take a step. Changing a control restarts the calculation.'}</p>
      <p data-descent="behavior">{behavior} {steps===MAX_DESCENT_STEPS?'The 12-step display limit is reached; this is not a convergence test.':''}</p>
      <details className="descent-history"><summary>Inspect the step values</summary><table><thead><tr><th>Step</th><th>Weight</th><th>Loss</th></tr></thead><tbody>{trace.map(r=><tr key={r.step}><td>{r.step}</td><td>{fmt(r.w)}</td><td>{fmt(r.loss)}</td></tr>)}</tbody></table><p className="local-note">Displayed values are rounded; calculations retain floating-point precision.</p></details>
    </div>
    <div className="print-only"><p>Start at w = 0, where loss = 4.5. After five updates:</p><table><thead><tr><th>Learning rate</th><th>Weight</th><th>Loss</th><th>Behavior from this start</th></tr></thead><tbody>{descentRates.map((r,i)=>{const row=descentTrace(0,r,5)[5];return <tr key={r}><td>{r}</td><td>{fmt(row.w)}</td><td>{fmt(row.loss)}</td><td>{['Approaches slowly','Approaches minimum','Reaches in one step','Alternates and approaches','Cycles, same loss','Alternates and moves away'][i]}</td></tr>;})}</tbody></table><p>At η = 0.5, the first update gives w = 1.5 and loss = 1.125. These are exact update rules with rounded displayed results. Starting at w = 3 leaves every displayed rate at the minimum.</p></div>
    <noscript><p>Enable JavaScript to take steps, or use the PDF and Python workbook for worked results.</p></noscript>
  </section>;
}
