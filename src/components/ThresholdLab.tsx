import { useState } from 'react';
import { evaluateThreshold } from '../lib/threshold.mjs';

const labels: Record<string,string> = { tp:'Spam caught', fp:'False alarm', fn:'Spam missed', tn:'Correctly accepted' };
export default function ThresholdLab() {
  const [threshold, setThreshold] = useState(.70);
  const result = evaluateThreshold(threshold);
  return <div className="lab" aria-label="Spam decision threshold experiment">
    <div className="lab-top"><span className="eyebrow">Interactive experiment 01</span><span className="lab-tag">Synthetic data · no training</span></div>
    <h4>Same scores. Different decisions.</h4>
    <p>Move the cutoff. Notice which mistakes appear and disappear.</p>
    <div className="slider-row"><label htmlFor="threshold">Flag at or above <output htmlFor="threshold">{threshold.toFixed(2)}</output></label>
    <input id="threshold" type="range" min="0" max="1" step="0.01" value={threshold} onChange={e=>setThreshold(Number(e.target.value))}/>
    <div className="range-labels"><span>0.00 · Flag more</span><span>1.00 · Flag fewer</span></div></div>
    <div className="lab-metrics" aria-live="polite" aria-atomic="true">
      <div><strong>{result.tp}/4</strong><span>Spam caught</span></div><div><strong>{result.fp}</strong><span>False alarms</span></div><div><strong>{result.fn}</strong><span>Spam missed</span></div><div><strong>{(result.accuracy*100).toFixed(1)}%</strong><span>Accuracy</span></div>
    </div>
    <div className="score-rows">{result.rows.map(row=><div className={`score-row ${row.outcome}`} key={row.id}>
      <span className="score-id">{row.id}</span><span className="score-name">{row.text}<small>Actual: {row.spam?'spam':'legitimate'}</small></span>
      <span className="score-track" aria-hidden="true"><span className="score-fill" style={{width:`${row.score*100}%`}}/><span className="threshold-line" style={{left:`${threshold*100}%`}}/></span>
      <span className="score-value">{row.score.toFixed(2)}</span><span className="outcome">{labels[row.outcome]}</span>
    </div>)}</div>
    <p className="lab-note">The line marks your threshold. The bars are fixed scores, not guaranteed probabilities. Flagging is a policy choice; moving this slider does not train a model.</p>
    <button className="small-button screen-only" onClick={()=>setThreshold(.70)}>Reset to 0.70</button>
    <p className="print-only">Print snapshot: at 0.70, A, B, C are flagged; 2 spam caught, 1 false alarm, 2 spam missed. At 0.40: 4 caught, 2 false alarms, 0 missed.</p>
  </div>;
}
