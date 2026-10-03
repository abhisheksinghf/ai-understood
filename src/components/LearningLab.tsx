import {useId,useState} from 'react';
import {trainingRows,validationRows,predict,meanSquaredError,initialLearningState,trainOneStep,MAX_STEPS} from '../lib/learning.mjs';

export default function LearningLab(){
  const [state,setState]=useState(initialLearningState);
  const [rate,setRate]=useState(.1);
  const [showValidation,setShowValidation]=useState(false);
  const plotId='learning-plot-'+useId().replace(/[^a-zA-Z0-9]/g,'');
  const xPos=(x:number)=>66+x/3.5*570;
  const yPos=(y:number)=>244-y/9*208;
  const display=(value:number)=>value.toFixed(4);
  const train=()=>setState(s=>trainOneStep(s,rate));
  const reset=()=>{setState(initialLearningState());setShowValidation(false);};
  return <section className="lab learning-lab" aria-labelledby="learning-lab-heading">
    <div className="lab-top"><span className="eyebrow">TRAIN A TINY MODEL</span><span className="lab-tag">Synthetic data · runs locally</span></div>
    <h4 id="learning-lab-heading">Predict. Compare. Adjust.</h4>
    <p>The model predicts price = w × floor area + 1. Area is in 1,000 sq ft; one price unit is ₹10 lakh. Only w changes; the +1 stays fixed.</p>
    <div className="training-controls screen-only">
      <label htmlFor="learning-rate">Learning rate <select id="learning-rate" value={rate} onChange={e=>{setRate(Number(e.target.value));reset();}}><option value={.02}>0.02 · smaller steps</option><option value={.1}>0.10 · suitable here</option><option value={.25}>0.25 · too large here</option></select></label>
      <button className="primary-button" onClick={train} disabled={state.stopped||state.steps>=MAX_STEPS}>Train one step</button>
      <button className="small-button" onClick={reset}>Reset training</button>
    </div>
    <div className="lab-metrics training-metrics screen-only" role="status" aria-live="polite" aria-atomic="true">
      <div><strong data-metric="steps">{state.steps}</strong><span>Training steps</span></div>
      <div><strong data-metric="weight">{display(state.weight)}</strong><span>Weight w</span></div>
      <div><strong data-metric="loss">{display(state.loss)}</strong><span>Training MSE · price units²</span></div>
    </div>
    <figure className="training-figure screen-only">
      <div className="training-plot-scroll" role="region" tabIndex={0} aria-label="Model prediction chart">
        <svg viewBox="0 0 700 292" role="img" aria-labelledby={plotId+'-title '+plotId+'-desc'}>
          <title id={plotId+'-title'}>{'House-price predictions at training step '+state.steps}</title>
          <desc id={plotId+'-desc'}>{'Floor area in thousands of square feet is on the horizontal axis, sale price in units of 10 lakh rupees on the vertical axis. Filled circles show three training examples at (1,3), (2,5), and (3,7). The line shows the current model with weight '+display(state.weight)+' and fixed intercept 1. Dashed vertical segments show training errors. '+(showValidation?'Hollow squares show validation examples at (1.5,4.2) and (2.5,5.8).':'')}</desc>
          <defs><clipPath id={plotId+'-clip'}><rect x="66" y="36" width="570" height="208"/></clipPath></defs>
          {[0,3,6,9].map(y=><g key={y}><line x1="66" x2="636" y1={yPos(y)} y2={yPos(y)} className="plot-grid"/><text x="52" y={yPos(y)+4} textAnchor="end" className="plot-tick">{y}</text></g>)}
          {[0,1,2,3].map(x=><text key={x} x={xPos(x)} y="263" textAnchor="middle" className="plot-tick">{x}</text>)}
          <text x="66" y="20" className="plot-label">Sale price (10 lakh rupees)</text><text x="351" y="284" textAnchor="middle" className="plot-label">Floor area (1,000 sq ft)</text>
          <line x1="66" x2="66" y1="36" y2="244" className="plot-axis"/><line x1="66" x2="636" y1="244" y2="244" className="plot-axis"/>
          <g clipPath={'url(#'+plotId+'-clip)'}>
            <line x1={xPos(0)} y1={yPos(predict(state.weight,0))} x2={xPos(3.5)} y2={yPos(predict(state.weight,3.5))} className="prediction-line"/>
            {trainingRows.map(row=><g key={row.x}><line x1={xPos(row.x)} x2={xPos(row.x)} y1={yPos(row.y)} y2={yPos(predict(state.weight,row.x))} className="error-line"/><circle cx={xPos(row.x)} cy={yPos(row.y)} r="5" className="training-point"/></g>)}
            {showValidation&&validationRows.map(row=><rect key={row.x} x={xPos(row.x)-5} y={yPos(row.y)-5} width="10" height="10" className="validation-point"/>)}
          </g>
        </svg>
      </div>
      <figcaption>Figure 2. Line = prediction; filled circles = training data; dashed segments = errors. Parts of the line outside 0–9 price units are clipped to the chart.</figcaption>
    </figure>
    <p className="lab-note screen-only" role="status">{state.stopped?'The loss exceeded 100 price units²: this rate makes the updates grow instead of settle. The demo stopped. Choose a smaller rate to restart.':state.steps>=MAX_STEPS?'20-step demo limit reached. Reset to try another run.':state.steps===0?'Try three steps at 0.10. Then choose 0.25, which starts a fresh run, and compare.':'The update used the training rows only. Lower training loss tells you about fit to those rows.'}</p>
    <div className="screen-only validation-panel">
      <button className="small-button" aria-expanded={showValidation} aria-controls={plotId+'-validation'} onClick={()=>setShowValidation(s=>!s)}>{showValidation?'Hide validation check':'Check validation examples'}</button>
      <div id={plotId+'-validation'} hidden={!showValidation}>
        <p>Separate examples: (1.5, 4.2) and (2.5, 5.8). Hollow squares show them on the chart. They are not used in gradient updates.</p>
        <p role="status"><strong>Validation MSE: <span data-metric="validation">{display(meanSquaredError(state.weight,validationRows))}</span> price units².</strong> This is a two-example demonstration, not a reliable performance estimate.</p>
        <p className="lab-note">Comparing learning rates using these results makes them development data. A final test set must stay separate.</p>
      </div>
    </div>
    <div className="print-only">
      <p><strong>Figure 2. Training experiment, printable results.</strong> Each step uses the three training examples. The intercept stays at 1.</p>
      <table><thead><tr><th>State</th><th>Weight w</th><th>Training MSE (price units²)</th></tr></thead><tbody>
        <tr><td>Start</td><td>1.0000</td><td>4.6667</td></tr>
        <tr><td>One step at rate 0.10</td><td>1.9333</td><td>0.0207</td></tr>
        <tr><td>Fit at w = 2</td><td>2.0000</td><td>0.0000</td></tr>
        <tr><td>Fresh start, one step at 0.25</td><td>3.3333</td><td>8.2963</td></tr>
      </tbody></table>
      <p>The larger rate overshoots and increases loss. At w = 2, the separate validation examples (1.5, 4.2) and (2.5, 5.8) have MSE 0.04 price units². They do not affect training updates.</p>
    </div>
    <noscript><p>Enable JavaScript to step through training, or use the worked results in the PDF.</p></noscript>
  </section>;
}
