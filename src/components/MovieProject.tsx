import {useState} from 'react';
import {catalog,topics,defaultPreferences,recommend} from '../lib/movie-project.mjs';
const printed=recommend();
export default function MovieProject(){
  const [topic,setTopic]=useState('learning');
  const [minutes,setMinutes]=useState('30');
  const [introductory,setLight]=useState(true);
  const [seen,setSeen]=useState<string[]>([]);
  let result:ReturnType<typeof recommend>|null=null;
  let problem='';
  try{
    if(!/^\d+$/.test(minutes))throw new Error('Enter whole minutes from 5 to 120.');
    result=recommend({topic,max_minutes:Number(minutes),prefer_introductory:introductory,completed_ids:seen});
  }catch(error){problem=error instanceof Error?error.message:'Check your preferences.';}
  const card=result?.recommendation;
  const reset=()=>{setTopic(defaultPreferences.topic);setMinutes('30');setLight(true);setSeen([]);};
  const download=()=>{
    if(!result)return;
    const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)+'\n'],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='chapter-11-study-result.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  return <section className="lab movie-project" aria-label="Study suggestion project">
    <div className="lab-top"><span className="eyebrow">YOUR FIRST COMPLETE PROJECT</span><span className="lab-tag">Local rules · authored study pack</span></div>
    <h3>What should I study next?</h3>
    <p>Choose your preferences and inspect the recommendation. Everything here runs in your browser; the explanation uses a template.</p>
    <div className="screen-only">
      <div className="training-controls">
        <label htmlFor="movie-genre">Required topic<select id="movie-genre" value={topic} onChange={e=>setTopic(e.target.value)}>{topics.map(g=><option value={g} key={g}>{g==='any'?'Any topic':g}</option>)}</select></label>
        <label htmlFor="movie-minutes">Available study time (minutes)<input id="movie-minutes" type="number" min="5" max="120" step="1" value={minutes} aria-invalid={!!problem} aria-describedby={problem?'movie-input-error':undefined} onChange={e=>setMinutes(e.target.value)}/></label>
      </div>
      <label className="movie-check"><input id="movie-light" type="checkbox" checked={introductory} onChange={e=>setLight(e.target.checked)}/> Prefer an introductory level <span className="local-note">Optional preference</span></label>
      <details className="workshop-detail"><summary>Exclude notes you have already completed ({seen.length})</summary><div className="movie-seen">{catalog.notes.map(m=><label className="movie-check" key={m.id}><input type="checkbox" value={m.id} checked={seen.includes(m.id)} onChange={e=>setSeen(e.target.checked?[...seen,m.id]:seen.filter(id=>id!==m.id))}/>{m.title}</label>)}</div></details>
      <div className="movie-result" aria-live="polite" aria-atomic="true" data-movie="result">
        {problem?<p id="movie-input-error" role="alert">{problem}</p>:card?<>
          <span className="eyebrow">SUGGESTED FROM {result!.eligible_ids.length} ELIGIBLE NOTES</span><h4 data-movie="title">{card.title}</h4>
          <p>{card.reason}</p><p><strong>From your note:</strong> {card.text}</p><p><strong>Exam date:</strong> {card.exam_date??'Unknown in this catalog.'}</p>
          <p className="local-note">Source: {card.note_id} · {result!.catalog_version}. Study estimates and exam dates are teaching examples.</p>
        </>:<><h4>No matching note</h4><p>Try a longer time limit, another topic, or review your completed list. Your constraints have not been changed automatically.</p></>}
      </div>
      <div className="workshop-actions"><button className="small-button" onClick={reset}>Reset preferences</button><button className="small-button" disabled={!result} onClick={download}>Download this result</button></div>
      {result&&<details className="workshop-detail"><summary>Why were these notes included or excluded?</summary><p>Keep matching, not yet completed notes with a known study-time estimate within your limit. Rank by introductory-level score (1 or 0), then shorter study-time estimate, then note ID. The score is not a probability.</p><div className="movie-table-wrap" tabIndex={0} role="region" aria-label="Note selection decisions"><table><thead><tr><th>Note</th><th>Decision</th><th>Score</th></tr></thead><tbody>{result.decisions.map(d=><tr key={d.note_id}><td>{d.title}</td><td>{d.eligible?'Eligible':d.reasons.join('; ')}</td><td>{d.score??'—'}</td></tr>)}</tbody></table></div><p data-movie="ranking"><strong>Ranked eligible IDs:</strong> {result.eligible_ids.join(' → ')||'None'}</p></details>}
    </div>
    <div className="print-only"><p><strong>Default run:</strong> learning, no more than 30 minutes, prefer an introductory level, no completed notes. {printed.recommendation!.reason} Exam timing remains unknown.</p><table><thead><tr><th>Note</th><th>Decision</th><th>Score</th></tr></thead><tbody>{printed.decisions.map(d=><tr key={d.note_id}><td>{d.title}</td><td>{d.eligible?'Eligible':d.reasons.join('; ')}</td><td>{d.score??'n/a'}</td></tr>)}</tbody></table><p>Ranking: N01 → N04 → N02. At a 10-minute limit, no learning-topic note qualifies. Excluding N01 at 30 minutes selects N04. Turning off the introductory preference in that last case selects N02.</p></div>
    <noscript><p>Enable JavaScript to change preferences, or use the PDF and Python project download.</p></noscript>
  </section>;
}
