import catalog from '../../public/downloads/chapter-16-search/movies.json' with {type:'json'};
export const dataset=catalog;
/** Deliberately small English analyzer, shared by queries and summaries. */
export function tokenize(text){
  if(typeof text!=='string')throw new Error('Text must be a string.');
  return text.toLowerCase().match(/[a-z0-9]+/g)||[];
}
const key=text=>[...new Set(tokenize(text))].sort().join(' ');
export function validateDataset(data=dataset){
  if(!data||data.version!=='movie-search-v1'||!Array.isArray(data.movies)||!data.movies.length||!Array.isArray(data.queries))throw new Error('Invalid catalog.');
  const ids=new Set(),queries=new Set();
  for(const d of data.movies){
    if(!d||typeof d.id!=='string'||!/^M\d{3}$/.test(d.id)||ids.has(d.id)||typeof d.title!=='string'||!d.title.trim()||typeof d.summary!=='string'||!tokenize(d.summary).length||!(d.runtime_minutes===null||(Number.isInteger(d.runtime_minutes)&&d.runtime_minutes>0)))throw new Error('Invalid movie.');
    ids.add(d.id);
  }
  for(const q of data.queries){
    if(!q||typeof q.query!=='string'||!key(q.query)||queries.has(key(q.query))||typeof q.intent!=='string'||!q.intent.trim()||!Array.isArray(q.relevant)||new Set(q.relevant).size!==q.relevant.length||q.relevant.some(id=>!ids.has(id)))throw new Error('Invalid query judgments.');
    queries.add(key(q.query));
  }
}
export function buildIndex(data=dataset){
  validateDataset(data);
  /** @type {Map<string, Map<string, number[]>>} */
  const postings=new Map();
  const documents=data.movies.map(movie=>{
    const tokens=tokenize(movie.summary);
    tokens.forEach((term,position)=>{
      if(!postings.has(term))postings.set(term,new Map());
      const list=postings.get(term);
      if(!list.has(movie.id))list.set(movie.id,[]);
      list.get(movie.id).push(position);
    });
    return {...movie,length:tokens.length};
  });
  return {documents,postings,n:documents.length,average_length:documents.reduce((s,d)=>s+d.length,0)/documents.length};
}
/** Scores are weights, not probabilities. Unknown terms contribute zero. */
export function termWeight(method,tf,df,n,length,average,k1=1.2,b=.75){
  if(!tf||!df)return 0;
  if(method==='overlap')return 1;
  if(method==='tfidf')return (1+Math.log(tf))*Math.log(n/df);
  if(method==='bm25')return Math.log(1+(n-df+.5)/(df+.5))*tf*(k1+1)/(tf+k1*(1-b+b*length/average));
  throw new Error('Unknown ranking method.');
}
export function rankingMetrics(ids,relevant,k){
  const matches=ids.slice(0,k).filter(id=>relevant.includes(id)).length;
  const first=ids.slice(0,k).findIndex(id=>relevant.includes(id));
  return {relevant_total:relevant.length,relevant_retrieved:matches,precision_at_k:matches/k,recall_at_k:relevant.length?matches/relevant.length:null,reciprocal_rank_at_k:first<0?0:1/(first+1)};
}
export function search(query='space rescue',method='bm25',mode='any',limit='all',k=3,k1=1.2,b=.75,data=dataset){
  if(typeof query!=='string'||query.length>200)throw new Error('Query must be text with at most 200 characters.');
  if(!['overlap','tfidf','bm25'].includes(method)||!['any','all'].includes(mode)||!['all','under120'].includes(limit)||!Number.isInteger(k)||k<1||k>10||!Number.isFinite(k1)||k1<0||k1>3||!Number.isFinite(b)||b<0||b>1)throw new Error('Invalid search settings.');
  const index=buildIndex(data),tokens=[...new Set(tokenize(query))];
  const terms=tokens.map(term=>({term,df:index.postings.get(term)?.size||0,postings:[...(index.postings.get(term)||new Map())].map(([id,positions])=>({id,tf:positions.length,positions}))}));
  const eligible=index.documents.filter(d=>limit==='all'||(d.runtime_minutes!==null&&d.runtime_minutes<120));
  const matches=terms.map(t=>new Set(t.postings.map(p=>p.id)));
  // Use the inverted lists to form candidates; AND includes unknown terms.
  const candidates=new Set(tokens.length?(mode==='any'?terms.flatMap(t=>t.postings.map(p=>p.id)):[...matches[0]].filter(id=>matches.every(m=>m.has(id)))):[]);
  const ranked=eligible.filter(d=>candidates.has(d.id)).map(d=>{
    const contributions=terms.map(t=>{
      const tf=index.postings.get(t.term)?.get(d.id)?.length||0;
      return {term:t.term,tf,df:t.df,weight:termWeight(method,tf,t.df,index.n,d.length,index.average_length,k1,b)};
    });
    return {...d,score:contributions.reduce((sum,t)=>sum+t.weight,0),contributions};
  }).sort((a,b)=>b.score-a.score||(a.id<b.id?-1:1));
  const results=ranked.slice(0,k),judgment=data.queries.find(q=>key(q.query)===key(query));
  const relevant=judgment?.relevant.filter(id=>eligible.some(d=>d.id===id));
  return {version:data.version,configuration:{query,method,mode,limit,k,k1,b},tokens,statistics:{documents:index.n,average_length:index.average_length,eligible:eligible.length,candidates:ranked.length},terms,results,evaluation:judgment?{intent:judgment.intent,judgments:'Authored binary judgments for all eight movies; eligibility changes with the runtime filter.',...rankingMetrics(results.map(d=>d.id),relevant,k)}:null};
}
