import {useId,useState} from 'react';
import {transforms,matvec,norm} from '../lib/linear-algebra.mjs';

const fmt=(value:number)=>Number(value.toFixed(3)).toString();
export default function MatrixLab(){
  const [choice,setChoice]=useState('stretch');
  const [first,setFirst]=useState(2),[second,setSecond]=useState(1);
  const selected=transforms.find(t=>t.id===choice)!;
  const input=[first,second],output=matvec(selected.matrix,input);
  const id='matrix-'+useId().replace(/[^a-zA-Z0-9]/g,'');
  const px=(x:number)=>280+30*x,py=(y:number)=>240-30*y;
  const zeroInput=norm(input)===0,zeroOutput=norm(output)===0;
  const reset=()=>{setChoice('stretch');setFirst(2);setSecond(1);};
  const description='Dimensionless coordinate plane. Input u = ('+input.map(fmt).join(', ')+'), output Au = ('+output.map(fmt).join(', ')+'). Both start at the origin. A zero vector is a point, with no direction.';
  return <section className="lab matrix-lab" aria-labelledby="matrix-lab-title">
    <div className="lab-top"><span className="eyebrow">PREDICT THE CHANGE</span><span className="lab-tag">Live matrix calculation</span></div>
    <h4 id="matrix-lab-title">One vector. Five transformations.</h4>
    <p>Choose a matrix and change the input coordinates. The page calculates Au directly; no model is trained. These coordinates have no physical units.</p>
    <div className="screen-only">
      <div className="training-controls">
        <label htmlFor="matrix-choice">Transformation <select id="matrix-choice" value={choice} onChange={e=>setChoice(e.target.value)}>{transforms.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
        <button className="small-button" onClick={reset}>Reset transformation</button>
      </div>
      <div className="matrix-controls">
        <label htmlFor="vector-first">First coordinate u₁: <strong>{fmt(first)}</strong><input id="vector-first" type="range" min="-3" max="3" step="0.5" value={first} onChange={e=>setFirst(Number(e.target.value))}/></label>
        <label htmlFor="vector-second">Second coordinate u₂: <strong>{fmt(second)}</strong><input id="vector-second" type="range" min="-3" max="3" step="0.5" value={second} onChange={e=>setSecond(Number(e.target.value))}/></label>
      </div>
      <div className="matrix-equation" role="status" aria-live="polite" aria-atomic="true">
        <p><strong>Matrix A:</strong> <code data-matrix="matrix">{selected.matrix.map(row=>'['+row.join(', ')+']').join(' ')}</code> <span className="local-note">(rows shown in order)</span></p>
        <p><strong>Au =</strong> <span data-matrix="output">[{output.map(fmt).join(', ')}]</span></p>
        <p className="matrix-working">First output: {selected.matrix[0][0]} × ({fmt(first)}) + {selected.matrix[0][1]} × ({fmt(second)}) = {fmt(output[0])}<br/>Second output: {selected.matrix[1][0]} × ({fmt(first)}) + {selected.matrix[1][1]} × ({fmt(second)}) = {fmt(output[1])}</p>
      </div>
      <figure className="matrix-figure">
        <div className="matrix-plot-scroll" role="region" tabIndex={0} aria-label="Vector transformation graph">
          <svg viewBox="0 0 560 470" role="img" aria-labelledby={id+'-title '+id+'-desc'}>
            <title id={id+'-title'}>{selected.label+' applied to the input vector'}</title><desc id={id+'-desc'}>{description}</desc>
            <defs>
              <marker id={id+'-input'} markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" refX="11" refY="6" orient="auto"><path d="M0 0 L12 6 L0 12 Z" fill="var(--gold)"/></marker>
              <marker id={id+'-output'} markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" refX="11" refY="6" orient="auto"><path d="M0 0 L12 6 L0 12 Z" fill="var(--accent)"/></marker>
            </defs>
            {Array.from({length:13},(_,i)=>i-6).map(t=><g key={t}><line x1={px(t)} x2={px(t)} y1="60" y2="420" className="plot-grid"/><line y1={py(t)} y2={py(t)} x1="100" x2="460" className="plot-grid"/></g>)}
            <line x1="85" x2="475" y1="240" y2="240" className="plot-axis"/><line x1="280" x2="280" y1="45" y2="435" className="plot-axis"/>
            {[-6,-3,3,6].map(t=><g key={t}><text x={px(t)} y="257" textAnchor="middle" className="plot-tick">{t}</text><text x="268" y={py(t)+4} textAnchor="end" className="plot-tick">{t}</text></g>)}
            <text x="268" y="257" textAnchor="end" className="plot-tick">0</text><text x="483" y="244" className="plot-label">axis 1</text><text x="280" y="28" textAnchor="middle" className="plot-label">axis 2</text>
            {!zeroInput&&<line x1="280" y1="240" x2={px(first)} y2={py(second)} stroke="var(--gold)" strokeWidth="4" strokeDasharray="7 4" markerEnd={'url(#'+id+'-input)'}/>}
            {!zeroOutput&&<line x1="280" y1="240" x2={px(output[0])} y2={py(output[1])} stroke="var(--accent)" strokeWidth="2.5" markerEnd={'url(#'+id+'-output)'}/>}
            <circle cx={px(first)} cy={py(second)} r="5" fill="var(--surface)" stroke="var(--gold)" strokeWidth="2"/>
            <rect x={px(output[0])-3.5} y={py(output[1])-3.5} width="7" height="7" fill="var(--accent)"/>
          </svg>
        </div>
        <figcaption>Dashed gold arrow and circle = input u. Solid green arrow and square = output Au. Both use the same axis scale; overlapping arrows mean overlapping vectors.</figcaption>
      </figure>
      <div className="lab-metrics matrix-metrics" role="status" aria-live="polite"><div><strong data-matrix="input-norm">{norm(input).toFixed(3)}</strong><span>Input length</span></div><div><strong data-matrix="output-norm">{norm(output).toFixed(3)}</strong><span>Output length</span></div></div>
      <p data-matrix="explanation" className="matrix-explanation">{selected.explanation} {zeroInput||zeroOutput?'A zero vector appears as a point at the origin and has no direction.':''}</p>
    </div>
    <div className="print-only">
      <p>Worked input u = [2, 1]. In every case, take a dot product with each row of A:</p>
      <table><thead><tr><th>Transformation</th><th>Rows of A</th><th>Output Au</th></tr></thead><tbody>{transforms.map(t=><tr key={t.id}><td>{t.label}</td><td>{t.matrix.map(row=>'['+row.join(', ')+']').join('; ')}</td><td>{'['+matvec(t.matrix,[2,1]).join(', ')+']'}</td></tr>)}</tbody></table>
      <p>Stretch: first output = 2 × 2 + 0 × 1 = 4; second output = 0 × 2 + 1 × 1 = 1. Rotation preserves length √5. Projection loses the second coordinate.</p>
    </div>
    <noscript><p>Enable JavaScript to change the vector, or use the PDF for all five worked transformations.</p></noscript>
  </section>;
}
