import catalog from '../../public/downloads/chapter-11-movie-project/catalog.json' with {type:'json'};
export {catalog};
export const genres=['any','adventure','comedy','action','drama','sci-fi'];
/** @type {{genre:string,max_minutes:number,prefer_light:boolean,seen_ids:string[]}} */
export const defaultPreferences={genre:'adventure',max_minutes:120,prefer_light:true,seen_ids:[]};
const nonempty=value=>typeof value==='string'&&!!value.trim();
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));
export function validateCatalog(data){
  if(!exact(data,['version','movies'])||!nonempty(data.version)||!Array.isArray(data.movies)||data.movies.length>100)throw new Error('Catalog needs a version and at most 100 movie records.');
  const ids=new Set();
  for(const m of data.movies){
    if(!exact(m,['id','title','genres','tone','runtime_minutes','streaming_service'])||!/^M[0-9]{3}$/.test(m.id)||ids.has(m.id)||!nonempty(m.title))throw new Error('Movie fields, IDs, or title are invalid.');
    if(!Array.isArray(m.genres)||!m.genres.length||new Set(m.genres).size!==m.genres.length||m.genres.some(g=>!genres.slice(1).includes(g)))throw new Error('Movie genres must be distinct known genres.');
    if(!['light','serious'].includes(m.tone)||!(m.runtime_minutes===null||(Number.isInteger(m.runtime_minutes)&&m.runtime_minutes>0&&m.runtime_minutes<=600))||!(m.streaming_service===null||nonempty(m.streaming_service)))throw new Error('Movie tone, runtime, or service is invalid.');
    ids.add(m.id);
  }
}
export function validatePreferences(p,data=catalog){
  if(!exact(p,['genre','max_minutes','prefer_light','seen_ids'])||!genres.includes(p.genre)||!Number.isInteger(p.max_minutes)||p.max_minutes<30||p.max_minutes>240||typeof p.prefer_light!=='boolean'||!Array.isArray(p.seen_ids)||p.seen_ids.some(id=>typeof id!=='string'||!data.movies.some(m=>m.id===id))||new Set(p.seen_ids).size!==p.seen_ids.length)throw new Error('Choose a known genre, whole minutes from 30 to 240, a light-tone preference, and distinct known seen IDs.');
}
export function recommend(p=defaultPreferences,data=catalog){
  validateCatalog(data);validatePreferences(p,data);
  const decisions=data.movies.map(m=>{
    const reasons=[];
    if(p.genre!=='any'&&!m.genres.includes(p.genre))reasons.push('Genre does not match');
    if(m.runtime_minutes===null)reasons.push('Runtime unknown');
    else if(m.runtime_minutes>p.max_minutes)reasons.push('Over time limit');
    if(p.seen_ids.includes(m.id))reasons.push('Already seen');
    return {movie_id:m.id,title:m.title,eligible:!reasons.length,reasons,score:!reasons.length?Number(p.prefer_light&&m.tone==='light'):null};
  });
  const eligible=data.movies.filter(m=>decisions.find(d=>d.movie_id===m.id).eligible);
  eligible.sort((a,b)=>Number(p.prefer_light&&b.tone==='light')-Number(p.prefer_light&&a.tone==='light')||a.runtime_minutes-b.runtime_minutes||(a.id<b.id?-1:a.id>b.id?1:0));
  const m=eligible[0];
  const recommendation=m?{movie_id:m.id,title:m.title,genres:m.genres,tone:m.tone,runtime_minutes:m.runtime_minutes,streaming_service:m.streaming_service,
    reason:`${m.title} is ${m.runtime_minutes} minutes, within your ${p.max_minutes}-minute limit. Genre: ${m.genres.join(', ')}. Tone: ${m.tone}. Selected by the stated ranking rule; enjoyment is not guaranteed.`}:null;
  return {status:m?'ok':'no_match',catalog_version:data.version,request:p,recommendation,eligible_ids:eligible.map(m=>m.id),decisions};
}
