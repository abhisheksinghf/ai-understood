import {useState} from 'react';
import cases from '../data/pythonTrace.json';

export default function PythonTrace(){
  const [caseIndex,setCaseIndex]=useState(0);
  const [step,setStep]=useState(0);
  const run=cases[caseIndex],row=step?run.rows[step-1]:null;
  const total=row?.running_total??0;
  return <section className="lab python-trace" aria-labelledby="python-trace-title">
    <div className="lab-top"><span className="eyebrow">FOLLOW THE VALUES</span><span className="lab-tag">Recorded Python execution</span></div>
    <h4 id="python-trace-title">One row at a time.</h4>
    <p>These snapshots come from the supplied Python program. The controls replay results; your browser does not execute Python.</p>
    <div className="screen-only">
      <div className="training-controls">
        <label htmlFor="trace-weight">Supplied weight w <select id="trace-weight" value={caseIndex} onChange={e=>{setCaseIndex(Number(e.target.value));setStep(0);}}><option value={0}>1.0 · initial example</option><option value={1}>2.0 · exact fit to these rows</option></select></label>
        <button className="primary-button" disabled={step===run.count} onClick={()=>setStep(s=>s+1)}>Next row</button>
        <button className="small-button" disabled={step===0} onClick={()=>setStep(s=>s-1)}>Previous row</button>
        <button className="small-button" onClick={()=>setStep(0)}>Reset trace</button>
      </div>
      <div className="lab-metrics training-metrics" role="status" aria-live="polite" aria-atomic="true">
        <div><strong data-trace="step">{step} / {run.count}</strong><span>Rows processed</span></div>
        <div><strong data-trace="total">{total.toFixed(1)}</strong><span>Squared-error total</span></div>
        <div><strong data-trace="mse">{step===run.count?run.mse.toFixed(4):'—'}</strong><span>MSE · after all rows</span></div>
      </div>
      <div className="trace-row-detail" role="status" aria-live="polite">
        {row?<p><strong>Row {step}:</strong> prediction = {run.weight.toFixed(1)} × {row.size.toFixed(1)} + 1 = {row.prediction.toFixed(1)}. Error = {row.prediction.toFixed(1)} − {row.actual.toFixed(1)} = {row.error.toFixed(1)}. Add its square, {row.squared_error.toFixed(1)}, to the running total.</p>:<p><strong>Before the loop:</strong> total = 0.0. The first row is still waiting. Predict the next total, then advance.</p>}
      </div>
      <table><thead><tr><th>Row</th><th>Prediction</th><th>Squared error</th><th>Running total</th></tr></thead><tbody>{run.rows.map((item,i)=><tr key={i} className={i===step-1?'trace-current':''}><td>{i+1}</td><td>{i<step?item.prediction.toFixed(1):'Pending'}</td><td>{i<step?item.squared_error.toFixed(1):'—'}</td><td>{i<step?item.running_total.toFixed(1):'—'}</td></tr>)}</tbody></table>
      <p className="lab-note">{step===run.count?'The loop is complete. The final average uses all three rows. No parameter update occurred.':'The average is left blank until all rows have been processed.'}</p>
    </div>
    <div className="print-only">
      <p>At w = 1, the recorded loop produces:</p>
      <table><thead><tr><th>Row</th><th>Prediction</th><th>Squared error</th><th>Running total</th></tr></thead><tbody>{cases[0].rows.map((item,i)=><tr key={i}><td>{i+1}</td><td>{item.prediction.toFixed(1)}</td><td>{item.squared_error.toFixed(1)}</td><td>{item.running_total.toFixed(1)}</td></tr>)}</tbody></table>
      <p>Final MSE = 14 / 3 = 4.6667 s². At w = 2, predictions are 3, 5, and 7; all errors and the final MSE are zero.</p>
    </div>
    <noscript><p>Enable JavaScript to replay the trace, or use the table in the PDF.</p></noscript>
  </section>;
}
