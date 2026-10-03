import {useState} from 'react';
import {catalog,genres,defaultPreferences,recommend} from '../lib/movie-project.mjs';
const printed=recommend();
export default function MovieProject(){
  const [genre,setGenre]=useState('adventure');
  const [minutes,setMinutes]=useState('120');
  const [light,setLight]=useState(true);
  const [seen,setSeen]=useState<string[]>([]);
  let result:ReturnType<typeof recommend>|null=null;
  let problem='';
  try{
    if(!/^\d+$/.test(minutes))throw new Error('Enter whole minutes from 30 to 240.');
    result=recommend({genre,max_minutes:Number(minutes),prefer_light:light,seen_ids:seen});
  }catch(error){problem=error instanceof Error?error.message:'Check your preferences.';}
  const card=result?.recommendation;
  const reset=()=>{setGenre(defaultPreferences.genre);setMinutes('120');setLight(true);setSeen([]);};
  const download=()=>{
    if(!result)return;
    const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)+'\n'],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='chapter-11-movie-result.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  return <section className="lab movie-project" aria-label="Movie recommendation project">
    <div className="lab-top"><span className="eyebrow">YOUR FIRST COMPLETE PROJECT</span><span className="lab-tag">Local rules · fictional catalog</span></div>
    <h3>What should we watch?</h3>
    <p>Choose your preferences and inspect the recommendation. Everything here runs in your browser; the explanation uses a template.</p>
    <div className="screen-only">
      <div className="training-controls">
        <label htmlFor="movie-genre">Required genre<select id="movie-genre" value={genre} onChange={e=>setGenre(e.target.value)}>{genres.map(g=><option value={g} key={g}>{g==='any'?'Any genre':g}</option>)}</select></label>
        <label htmlFor="movie-minutes">Maximum length (minutes)<input id="movie-minutes" type="number" min="30" max="240" step="1" value={minutes} aria-invalid={!!problem} aria-describedby={problem?'movie-input-error':undefined} onChange={e=>setMinutes(e.target.value)}/></label>
      </div>
      <label className="movie-check"><input id="movie-light" type="checkbox" checked={light} onChange={e=>setLight(e.target.checked)}/> Prefer a light tone <span className="local-note">Optional preference</span></label>
      <details className="workshop-detail"><summary>Exclude movies you have already seen ({seen.length})</summary><div className="movie-seen">{catalog.movies.map(m=><label className="movie-check" key={m.id}><input type="checkbox" value={m.id} checked={seen.includes(m.id)} onChange={e=>setSeen(e.target.checked?[...seen,m.id]:seen.filter(id=>id!==m.id))}/>{m.title}</label>)}</div></details>
      <div className="movie-result" aria-live="polite" aria-atomic="true" data-movie="result">
        {problem?<p id="movie-input-error" role="alert">{problem}</p>:card?<>
          <span className="eyebrow">SUGGESTED FROM {result!.eligible_ids.length} ELIGIBLE MOVIES</span><h4 data-movie="title">{card.title}</h4>
          <p>{card.reason}</p><p><strong>Where to watch:</strong> {card.streaming_service??'Unknown in this catalog.'}</p>
          <p className="local-note">Source: {card.movie_id} · {result!.catalog_version}. Movie titles and StreamBox are fictional.</p>
        </>:<><h4>No matching movie</h4><p>Try a longer time limit, another genre, or review your seen list. Your constraints have not been changed automatically.</p></>}
      </div>
      <div className="workshop-actions"><button className="small-button" onClick={reset}>Reset preferences</button><button className="small-button" disabled={!result} onClick={download}>Download this result</button></div>
      {result&&<details className="workshop-detail"><summary>Why were these movies included or excluded?</summary><p>Keep matching, unseen movies with a known runtime within your limit. Rank by light-tone score (1 or 0), then shorter runtime, then movie ID. The score is not a probability.</p><div className="movie-table-wrap" tabIndex={0} role="region" aria-label="Movie selection decisions"><table><thead><tr><th>Movie</th><th>Decision</th><th>Score</th></tr></thead><tbody>{result.decisions.map(d=><tr key={d.movie_id}><td>{d.title}</td><td>{d.eligible?'Eligible':d.reasons.join('; ')}</td><td>{d.score??'—'}</td></tr>)}</tbody></table></div><p data-movie="ranking"><strong>Ranked eligible IDs:</strong> {result.eligible_ids.join(' → ')||'None'}</p></details>}
    </div>
    <div className="print-only"><p><strong>Default run:</strong> adventure, no more than 120 minutes, prefer a light tone, no seen movies. {printed.recommendation!.reason} Streaming availability remains unknown.</p><table><thead><tr><th>Movie</th><th>Decision</th><th>Score</th></tr></thead><tbody>{printed.decisions.map(d=><tr key={d.movie_id}><td>{d.title}</td><td>{d.eligible?'Eligible':d.reasons.join('; ')}</td><td>{d.score??'n/a'}</td></tr>)}</tbody></table><p>Ranking: M001 → M003 → M004. At a 90-minute limit, no adventure qualifies. Excluding M001 at 120 minutes selects M003. Turning off the light preference in that last case selects M004.</p></div>
    <noscript><p>Enable JavaScript to change preferences, or use the PDF and Python project download.</p></noscript>
  </section>;
}
