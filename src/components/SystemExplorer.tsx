import { useState } from 'react';

const designs=[
  {name:'Classify',title:'A movie-review classifier',path:'Review → trained decision tree → sentiment',labels:['AI','ML','NLP'],reason:'The task is language classification. This example uses a decision tree, so it does not require deep learning, an LLM, or generation.',changed:'The model returns a category, such as “positive”.',check:'Does it assign the right category on new reviews?'},
  {name:'Draft',title:'An LLM recommendation writer',path:'Movie facts + preferences → LLM → explanation',labels:['AI','ML','Deep learning','NLP','LLM','GenAI'],reason:'A deep-learning language model generates prose from the movie facts you provide. There is no automatic document retrieval or model-directed tool loop here.',changed:'The task is now explaining a movie suggestion from supplied evidence.',check:'Does the draft preserve facts and avoid unsupported claims?'},
  {name:'Retrieve',title:'A RAG movie assistant',path:'Question → catalog search → evidence + LLM → answer',labels:['AI','ML','Deep learning','NLP','LLM','GenAI','RAG'],reason:'Application code retrieves relevant movie entries and adds them to the model input. The route remains a fixed workflow.',changed:'The application supplies retrieved evidence at answer time.',check:'Were the right passages retrieved, and do they support the answer?'},
  {name:'Investigate',title:'An assistant with an agent loop',path:'Goal → model chooses tool → observation → decide again',labels:['AI','ML','Deep learning','NLP','LLM','GenAI','RAG','LLM agent'],reason:'In this version, the model can search the catalog, read movie entries, or finish based on earlier results. Catalog evidence still supports generated answers, so RAG remains part of this design.',changed:'The model helps choose subsequent steps within application limits.',check:'Does the loop reach a supported answer, use tools correctly, and stop?'}
];

export default function SystemExplorer(){
  const [selected,setSelected]=useState(0);
  const d=designs[selected];
  return <section className="lab system-explorer" aria-labelledby="explorer-heading">
    <div className="lab-top"><p className="eyebrow" id="explorer-heading">ONE ASSISTANT, FOUR DESIGNS</p><span className="lab-tag">Illustration · no API calls</span></div>
    <p className="screen-only">Choose a design to see which labels fit and why.</p>
    <div className="design-switcher screen-only" role="group" aria-label="Choose an assistant design">
      {designs.map((item,i)=><button key={item.name} aria-pressed={selected===i} onClick={()=>setSelected(i)}>{String(i+1).padStart(2,'0')} · {item.name}</button>)}
    </div>
    <div className="design-result screen-only" aria-live="polite" aria-atomic="true">
      <h3>{d.title}</h3><p className="design-path">{d.path}</p>
      <ul className="concept-labels" aria-label="Applicable labels">{d.labels.map(label=><li key={label}>{label}</li>)}</ul>
      <p>{d.reason}</p><p><strong>What changed:</strong> {d.changed}</p><p className="lab-note"><strong>Evaluate:</strong> {d.check}</p>
    </div>
    <div className="print-only"><p>Compare these four illustrative designs:</p><table><thead><tr><th>Design</th><th>What it contains</th><th>Check its result</th></tr></thead><tbody>{designs.map(item=><tr key={item.name}><td><strong>{item.name}</strong></td><td>{item.path}<br/>{item.labels.join(', ')}</td><td>{item.check}</td></tr>)}</tbody></table></div>
    <noscript><p>The interactive comparison needs JavaScript. The PDF contains all four designs and their labels.</p></noscript>
  </section>;
}
