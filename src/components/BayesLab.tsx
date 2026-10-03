import {useState} from 'react';
import {alertScenario} from '../lib/statistics.mjs';

const count=(n:number)=>n.toLocaleString('en-US',{maximumFractionDigits:2});
export default function BayesLab(){
  const [baseRate,setBaseRate]=useState(1),[recall,setRecall]=useState(90),[falsePositiveRate,setFalsePositiveRate]=useState(5);
  const result=alertScenario({baseRate:baseRate/100,recall:recall/100,falsePositiveRate:falsePositiveRate/100});
  const precision=result.precision===null?'Undefined':(100*result.precision).toFixed(2)+'%';
  const reset=()=>{setBaseRate(1);setRecall(90);setFalsePositiveRate(5);};
  return <section className="lab bayes-lab" aria-labelledby="bayes-lab-title">
    <div className="lab-top"><span className="eyebrow">CHANGE THE DENOMINATOR</span><span className="lab-tag">Live probability calculation</span></div>
    <h4 id="bayes-lab-title">How much should you trust an alert?</h4>
    <p>Expected counts for 10,000 hypothetical emails. Change the assumed rates; no random sample is drawn and no classifier is trained.</p>
    <div className="screen-only">
      <div className="bayes-controls">
        <label htmlFor="spam-rate">Spam base rate: <strong>{baseRate}%</strong><input id="spam-rate" type="range" min="0" max="50" step="1" value={baseRate} onChange={e=>setBaseRate(Number(e.target.value))}/></label>
        <label htmlFor="recall-rate">Recall (alerts among spam emails): <strong>{recall}%</strong><input id="recall-rate" type="range" min="0" max="100" step="5" value={recall} onChange={e=>setRecall(Number(e.target.value))}/></label>
        <label htmlFor="false-alert-rate">False-positive rate (alerts among legitimate): <strong>{falsePositiveRate}%</strong><input id="false-alert-rate" type="range" min="0" max="20" step="1" value={falsePositiveRate} onChange={e=>setFalsePositiveRate(Number(e.target.value))}/></label>
      </div>
      <button className="small-button" onClick={reset}>Reset alert rates</button>
      <div className="lab-metrics bayes-metrics" role="status" aria-live="polite" aria-atomic="true">
        <div><strong data-bayes="true-alerts">{count(result.truePositive)}</strong><span>True alerts</span></div>
        <div><strong data-bayes="false-alerts">{count(result.falsePositive)}</strong><span>False alerts</span></div>
        <div><strong data-bayes="precision">{precision}</strong><span>Spam probability given an alert</span></div>
      </div>
      <div className="alert-composition" role="img" aria-label={result.alerts===0?'No alerts: there is no conditional fraction to display.':`${count(result.truePositive)} true alerts and ${count(result.falsePositive)} false alerts out of ${count(result.alerts)} total alerts.`}>
        {result.precision===null?<span className="empty-alerts">No alerts to divide</span>:<><span className="true-alert-segment" style={{width:100*result.precision+'%'}}/><span className="false-alert-segment" style={{width:100*(1-result.precision)+'%'}}/></>}
      </div>
      <p className="alert-legend"><span>■ Solid green = true alerts</span><span>▧ Striped gold = false alerts</span></p>
      <table><caption>Expected counts by actual outcome</caption><thead><tr><th scope="col">Actual outcome</th><th scope="col">Alert</th><th scope="col">No alert</th></tr></thead><tbody><tr><th scope="row">Spam</th><td>{count(result.truePositive)}</td><td>{count(result.falseNegative)}</td></tr><tr><th scope="row">Legitimate</th><td>{count(result.falsePositive)}</td><td>{count(result.trueNegative)}</td></tr></tbody></table>
      <p data-bayes="calculation" className="bayes-calculation">{result.precision===null?'P(spam | alert) is undefined because there are zero alerts. This is not 0%.':`${count(result.truePositive)} / (${count(result.truePositive)} + ${count(result.falsePositive)}) = ${precision} of alerts identify spam emails.`}</p>
      <p className="local-note">Rates are inputs, not estimates from these counts. At a 0% base rate, the assumed recall has no spam emails to act on; a measured recall would be undefined.</p>
    </div>
    <div className="print-only">
      <p>Compare the same 10,000 hypothetical emails under four assumptions. FPR means false-positive rate.</p>
      <table><thead><tr><th>Base / recall / FPR</th><th>True alerts</th><th>False alerts</th><th>P(spam | alert)</th></tr></thead><tbody><tr><td>1% / 90% / 5%</td><td>90</td><td>495</td><td>15.38%</td></tr><tr><td>10% / 90% / 5%</td><td>900</td><td>450</td><td>66.67%</td></tr><tr><td>1% / 90% / 0%</td><td>90</td><td>0</td><td>100%</td></tr><tr><td>1% / 0% / 0%</td><td>0</td><td>0</td><td>Undefined</td></tr></tbody></table>
      <p>Precision divides true alerts by all alerts. A zero denominator is undefined, not 0%. These are expected counts under stated rates, not a simulation or measured performance.</p>
    </div>
    <noscript><p>Enable JavaScript to change rates, or use the PDF for the four worked cases.</p></noscript>
  </section>;
}
