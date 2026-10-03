import snapshot from '../../public/downloads/chapter-17-vector-search/vectors.json' with {type:'json'};
import {search as lexicalSearch,rankingMetrics} from './information-retrieval.mjs';
export const dataset=snapshot;
export const dot=(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0);
export const norm=v=>Math.sqrt(dot(v,v));
export const unit=v=>v.map(x=>x/norm(v));
export const cosine=(a,b)=>Math.max(-1,Math.min(1,dot(a,b)/(norm(a)*norm(b))));
export const distance=(a,b)=>Math.sqrt(a.reduce((s,x,i)=>s+(x-b[i])**2,0));
const byId=(a,b)=>a.id<b.id?-1:a.id>b.id?1:0;
export function validateSnapshot(data=dataset){
  if(!data||data.version!=='movie-vectors-v1'||data.dimensions!==3||typeof data.space_id!=='string'||!data.space_id.trim()||typeof data.provenance!=='string'||!Array.isArray(data.movies)||!data.movies.length||!Array.isArray(data.queries)||!data.queries.length||!Array.isArray(data.centroids)||data.centroids.length!==3)throw new Error('Invalid vector snapshot.');
  for(const group of [data.movies,data.queries,data.centroids]){
    const ids=new Set();
    for(const r of group){
      if(!r||typeof r.id!=='string'||!r.id.trim()||ids.has(r.id)||r.space_id!==data.space_id||!Array.isArray(r.vector)||r.vector.length!==data.dimensions||r.vector.some(x=>typeof x!=='number'||!Number.isFinite(x)||Math.abs(x)>1e6)||norm(r.vector)<1e-12)throw new Error('Invalid ID, vector, or embedding-space contract.');
      ids.add(r.id);
    }
  }
  // Reuse the lexical catalog and relevance validation, independently of scoring.
  lexicalSearch('', 'bm25','any','all',3,1.2,.75,{version:'movie-search-v1',movies:data.movies,queries:data.queries});
}
export function experiment(queryId='space',metric='cosine',normalization='raw',mode='exact',limit='all',k=3,data=dataset){
  validateSnapshot(data);
  if(!['cosine','dot','euclidean'].includes(metric)||!['raw','unit'].includes(normalization)||!['exact','probe1','probe2','probe3'].includes(mode)||!['all','under120'].includes(limit)||!Number.isInteger(k)||k<1||k>8||(mode!=='exact'&&metric!=='cosine'))throw new Error('Invalid vector-search settings. Coarse search uses cosine.');
  const q=data.queries.find(q=>q.id===queryId);if(!q)throw new Error('Unknown preset query.');
  const transform=v=>normalization==='unit'?unit(v):[...v];
  const queryVector=transform(q.vector);
  const cells=data.centroids.map(c=>({id:c.id,vector:c.vector,query_similarity:cosine(q.vector,c.vector),members:[]}));
  const documents=data.movies.map(d=>{
    const nearest=[...data.centroids].sort((a,b)=>cosine(d.vector,b.vector)-cosine(d.vector,a.vector)||byId(a,b))[0];
    cells.find(c=>c.id===nearest.id).members.push(d.id);
    return {...d,active_vector:transform(d.vector),cell:nearest.id,eligible:limit==='all'||(d.runtime_minutes!==null&&d.runtime_minutes<120)};
  });
  const visited=mode==='exact'?cells.map(c=>c.id):[...cells].sort((a,b)=>b.query_similarity-a.query_similarity||byId(a,b)).slice(0,Number(mode.slice(-1))).map(c=>c.id);
  const score=v=>metric==='cosine'?cosine(queryVector,v):metric==='dot'?dot(queryVector,v):distance(queryVector,v);
  const eligible=documents.filter(d=>d.eligible);
  /** @param {typeof documents} rows */
  const rank=rows=>rows.map(d=>({...d,value:score(d.active_vector)})).sort((a,b)=>(metric==='euclidean'?a.value-b.value:b.value-a.value)||byId(a,b));
  const candidates=rank(eligible.filter(d=>visited.includes(d.cell)));
  const reference=rank(eligible);
  const results=candidates.slice(0,k),exactIds=reference.slice(0,k).map(d=>d.id);
  const relevant=q.relevant.filter(id=>eligible.some(d=>d.id===id));
  const lexical=lexicalSearch(q.query,'bm25','any',limit,k,1.2,.75,{version:'movie-search-v1',movies:data.movies,queries:data.queries});
  return {version:data.version,space_id:data.space_id,provenance:data.provenance,configuration:{query_id:queryId,metric,normalization,mode,limit,k},query:{text:q.query,intent:q.intent,vector:q.vector,active_vector:queryVector},index:{cells:cells.map(c=>({...c,visited:visited.includes(c.id)})),eligible:eligible.length,searched_candidates:candidates.length},documents,results,evaluation:rankingMetrics(results.map(d=>d.id),relevant,k),audit:{exact_ids:exactIds,neighbor_recall_at_k:exactIds.length?results.filter(d=>exactIds.includes(d.id)).length/exactIds.length:null,explanation:'Exact reference scan is computed separately for teaching; candidate count is not a latency benchmark.'},lexical:{results:lexical.results.map(d=>({id:d.id,title:d.title,score:d.score})),evaluation:rankingMetrics(lexical.results.map(d=>d.id),relevant,k)}};
}
