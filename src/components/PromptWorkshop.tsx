import {useState} from 'react';
import {buildPrompt,promptCases,promptVersions,validateRecommendation} from '../lib/prompt-workshop.mjs';
export default function PromptWorkshop(){
  const [caseId,setCaseId]=useState('incomplete'),[version,setVersion]=useState('grounded');
  const [candidate,setCandidate]=useState(''),[result,setResult]=useState<string[]|null>(null);
  const selected=promptCases.find(c=>c.id===caseId)!,choice=promptVersions.find(v=>v.id===version)!;
  const prompt=buildPrompt(caseId,version);
  function load(kind:string){
    const recommendation=structuredClone(selected.reference);
    const value=kind==='type'?{...recommendation,exam_date:42}:kind==='unsupported'?{...recommendation,exam_date:'2026-12-01 [S1]'}:recommendation;
    setCandidate(JSON.stringify(value,null,2));setResult(null);
  }
  function check(){try{setResult(validateRecommendation(JSON.parse(candidate),selected.sources.map(s=>s.id)));}catch{setResult(['Invalid JSON: check quotes, commas, and brackets.']);}}
  function download(){const url=URL.createObjectURL(new Blob([prompt+'\n'],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`chapter-09-${caseId}-${version}-prompt.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  return <section className="lab prompt-workshop" aria-labelledby="prompt-workshop-title">
    <div className="lab-top"><span className="eyebrow">MAKE THE REQUIREMENTS VISIBLE</span><span className="lab-tag">Local prompt builder · no LLM</span></div>
    <h4 id="prompt-workshop-title">Same evidence. Clearer instructions.</h4>
    <p>Compare prompt designs against a human-written reference. The page assembles text and checks JSON; it does not generate or grade model answers.</p>
    <div className="screen-only">
      <div className="training-controls"><label htmlFor="prompt-case">Evidence case<select id="prompt-case" value={caseId} onChange={e=>{setCaseId(e.target.value);setCandidate('');setResult(null);}}>{promptCases.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label><label htmlFor="prompt-version">Prompt version<select id="prompt-version" value={version} onChange={e=>setVersion(e.target.value)}>{promptVersions.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}</select></label></div>
      <p className="prompt-design-note" data-prompt="design-note" role="status" aria-live="polite">{choice.note}</p>
      <label className="workshop-label" htmlFor="assembled-prompt">Assembled prompt (read-only)</label>
      <textarea id="assembled-prompt" className="prompt-text" readOnly value={prompt} rows={10} spellCheck={false}/>
      <button className="small-button" onClick={download}>Download this prompt</button>
      <details className="workshop-detail"><summary>Inspect the source records</summary>{selected.sources.map(s=><div key={s.id}><strong>{s.id} · {s.title}</strong><p>{s.text}</p></div>)}</details>
      <details className="workshop-detail"><summary>Reveal the human-written reference</summary><p>This reference belongs to the selected case and stays the same across prompt versions. It is not a model response.</p><pre data-prompt="reference"><code>{JSON.stringify(selected.reference,null,2)}</code></pre><p data-prompt="lesson">{selected.lesson}</p></details>
      <details className="workshop-detail prompt-checker"><summary>Try the JSON checker—and its limits</summary><p>Load a prepared example or paste JSON. This checker tests field types and listed source IDs; it cannot verify factual support or whether every claim is cited.</p><div className="workshop-actions"><button className="small-button" onClick={()=>load('reference')}>Load reference</button><button className="small-button" onClick={()=>load('type')}>Load wrong type</button><button className="small-button" onClick={()=>load('unsupported')}>Load unsupported claim</button></div><label className="workshop-label" htmlFor="candidate-recommendation">Candidate recommendation JSON</label><textarea id="candidate-recommendation" className="prompt-text" value={candidate} onChange={e=>{setCandidate(e.target.value);setResult(null);}} rows={8} spellCheck={false}/><button className="primary-button" onClick={check} disabled={!candidate.trim()}>Check structure</button>
        {result!==null&&<div className="prompt-check-result" role="status" aria-live="polite" data-prompt="result">{result.length?<><strong>Structural checks failed.</strong><ul>{result.map(error=><li key={error}>{error}</li>)}</ul></>:<><strong>Structural checks passed.</strong><p>This does not verify facts or citation support. The prepared 2026-12-01 claim is unsupported even when this check passes.</p></>}</div>}
      </details>
    </div>
    <div className="print-only"><p>Three prompt designs use the same source data: (1) a vague request, (2) a task and four JSON fields, and (3) evidence rules as well as the task and format. No model was run to compare them.</p><table><thead><tr><th>Case</th><th>Expected behavior in the authored reference</th></tr></thead><tbody><tr><td>Exam timing missing</td><td>Suggest the suitable note; exam_date is null.</td></tr><tr><td>Exam timing supplied</td><td>Use 2026-11-15 because S3 explicitly supplies it.</td></tr><tr><td>Study estimates disagree</td><td>Preserve 20 and 40 minutes; do not confirm a fit within 30 minutes.</td></tr><tr><td>Embedded instruction</td><td>Respect learner preferences; treat the catalog command as data.</td></tr></tbody></table><p><strong>Reference for the incomplete case:</strong> {promptCases[0].reference.recommendation} exam_date: null. Open question: when is the exam for this topic?</p><p><strong>Checker comparison:</strong> the reference passes structure; a numeric exam_date fails its type check; an unsupported 2026-12-01 claim can pass structure. Source comparison is still required. Full prompts and cases are in the workbook.</p></div>
    <noscript><p>Enable JavaScript for the workshop, or use the PDF and downloadable Python workbook.</p></noscript>
  </section>;
}
