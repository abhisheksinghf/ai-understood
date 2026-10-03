import {useState} from 'react';
import {dataset,experiment,sourceBlock} from '../lib/rag-pipeline.mjs';
export default function RagLab(){
 const [query,setQuery]=useState('plot'),[chunking,setChunking]=useState('card'),[k,setK]=useState(3),[budget,setBudget]=useState(120),[limit,setLimit]=useState('all'),[fault,setFault]=useState('none');
 const r=experiment(query,chunking,k,budget,limit,fault);
 const status=r.validation.status;
 function reset(){setQuery('plot');setChunking('card');setK(3);setBudget(120);setLimit('all');setFault('none');}
 function download(){const url=URL.createObjectURL(new Blob([JSON.stringify(r,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='chapter-18-rag-trace.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <section className="lab rag-lab" aria-label="RAG pipeline explorer">
  <div className="lab-top"><span className="eyebrow">FOLLOW THE EVIDENCE.</span><span className="lab-tag">Local calculations · no LLM call</span></div>
  <h3>Same question. Different evidence.</h3>
  <p>Real chunking, BM25 retrieval, context packing, and quote checks on eight fictional movies. The offline formatter selects a full source sentence for a preset fact type; it does not understand arbitrary questions or generate language.</p>
  <div className="screen-only">
   <div className="training-controls">
    <label>Question<select id="rag-query" value={query} onChange={e=>setQuery(e.target.value)}>{dataset.queries.map(q=><option key={q.id} value={q.id}>{q.question}</option>)}</select></label>
    <label>Chunk boundaries<select id="rag-chunking" value={chunking} onChange={e=>setChunking(e.target.value)}><option value="card">Whole movie card</option><option value="section">Separate plot and runtime</option></select></label>
    <label>Candidate limit (K)<select id="rag-k" value={k} onChange={e=>setK(Number(e.target.value))}>{[1,3,5].map(v=><option key={v}>{v}</option>)}</select></label>
    <label>Evidence budget (word units)<select id="rag-budget" value={budget} onChange={e=>setBudget(Number(e.target.value))}>{[0,20,50,120].map(v=><option key={v}>{v}</option>)}</select></label>
    <label>Runtime eligibility<select id="rag-limit" value={limit} onChange={e=>setLimit(e.target.value)}><option value="all">No limit</option><option value="under120">Known runtime below 120 minutes</option></select></label>
    <label>Answer fixture<select id="rag-fault" value={fault} onChange={e=>setFault(e.target.value)}><option value="none">Evidence formatter</option><option value="bad_id">Invent a source ID</option><option value="bad_quote">Invent a streaming claim</option></select></label>
   </div>
   <p className="rag-question"><strong>Search text:</strong> <span data-rag="search">{r.search_query}</span><br/><strong>Question:</strong> {r.question}</p>
   <div className="lab-metrics rag-metrics"><div><strong data-rag="chunks">{r.chunks.length}</strong><span>Indexed chunks</span></div><div><strong data-rag="candidates">{r.candidates.length}</strong><span>Retrieved candidates</span></div><div><strong data-rag="context">{r.context.selected.length}</strong><span>Packed chunks</span></div><div><strong data-rag="units">{r.context.used}/{budget}</strong><span>Evidence word units</span></div></div>
   <p className="lab-note">Budget counts whitespace-separated units in complete source blocks, including IDs and headings. It is not an LLM token count. Chunks that do not fit are skipped; smaller later chunks may fit.</p>
   <div className="rag-table-wrap"><table className="rag-ranking"><thead><tr><th>Retrieved chunk</th><th>BM25</th><th>Context decision</th></tr></thead><tbody>{r.candidates.map(c=><tr key={c.id} data-chunk-id={c.id}><td><strong>{c.title}</strong><small>{c.id}</small></td><td data-rag-score>{c.score.toFixed(4)}</td><td>{r.context.selected.some(s=>s.id===c.id)?'Included':'Over budget'}</td></tr>)}</tbody></table></div>
   <div className={'rag-answer '+(status==='blocked'?'rag-blocked':'')} role="status" aria-live="polite">
    <span className="eyebrow" data-rag="status">{status}</span>
    <h4>{status==='evidence_ready'?'Evidence with a traceable source':status==='blocked'?'Candidate blocked by the checker':'Not enough evidence in this context'}</h4>
    {status==='insufficient_evidence'&&<p>The formatter found no complete sentence for the requested fact. This says nothing about whether the answer exists elsewhere.</p>}
    {r.validation.problems.map(p=><p key={p}>{p}</p>)}
    {r.validation.evidence.map((e,i)=><div key={i} className="rag-evidence"><strong>{e.title}</strong><blockquote>{e.quote}</blockquote><a href={'#rag-source-'+e.source_id} onClick={()=>{const d=document.getElementById('rag-context');if(d instanceof HTMLDetailsElement)d.open=true;}}>View {e.source_id} →</a></div>)}
   </div>
   <p className="lab-note">“Evidence ready” means the ID is in this context and the quote occurs there. It does not certify relevance, completeness, source truth, or safety. A real but irrelevant quote can pass.</p>
   <details id="rag-context" className="workshop-detail"><summary>Inspect the packed context</summary>{r.context.selected.length?r.context.selected.map(c=><article id={'rag-source-'+c.id} key={c.id} className="rag-source"><strong>{c.id} · {c.units} units</strong><pre>{sourceBlock(c)}</pre></article>):<p>No source block fitted the budget.</p>}</details>
   <details className="workshop-detail rag-prompt"><summary>Inspect the prompt and candidate JSON</summary><h4>System instruction</h4><pre>{r.prompt.system}</pre><h4>User message with source data</h4><pre>{r.prompt.user}</pre><h4>Candidate before checks</h4><pre>{JSON.stringify(r.candidate,null,2)}</pre></details>
   <div className="workshop-actions"><button type="button" className="small-button" onClick={reset}>Reset RAG explorer</button><button type="button" className="small-button" onClick={download}>Download RAG trace</button></div>
  </div>
  <div className="print-only">
   <p>Default question: “What is Quiet Orbit about?” Search: “Quiet Orbit.” Whole-card chunking, K = 3, evidence budget = 120 word units, no runtime filter.</p>
   <table><thead><tr><th>Change</th><th>Evidence reaching the answer step</th><th>Outcome</th></tr></thead><tbody><tr><td>Default</td><td>Quiet Orbit card (21 units), Winter Road card (22)</td><td>Quote Quiet Orbit's synopsis</td></tr><tr><td>Sections, K = 1</td><td>Quiet Orbit runtime chunk only (11)</td><td>Insufficient plot evidence</td></tr><tr><td>Sections, K = 3</td><td>Quiet Orbit runtime + plot, Winter Road plot (48 total)</td><td>Quote Quiet Orbit's synopsis</td></tr><tr><td>Ask where to stream it</td><td>Plot and runtime, no availability field</td><td>Insufficient evidence</td></tr></tbody></table>
   <p>Default evidence: “A space crew plans a rescue near a silent planet.” [M004:r1:card]. A made-up source ID or streaming quote is blocked. These are deterministic outcomes from the workbook, not measured LLM behavior.</p>
  </div>
 </section>;
}
