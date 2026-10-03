import data from '../../public/downloads/chapter-37-reasoning/data.json' with {type:'json'};
export const defaults={minutes:100,offline:'yes',evidence:'liked',prior:50,penalty:4};
export const choices={minutes:[80,100,120],offline:['yes','no'],evidence:['unknown','liked','disliked'],prior:[20,50,80],penalty:[1,4,10]};
const round=n=>Math.round(n*1e6)/1e6;
export function normalize(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('Expected a configuration object');
 for(const key of Object.keys(input))if(!(key in defaults))throw new RangeError('Unknown option: '+key);
 const c={...defaults,...input};
 for(const [key,values] of Object.entries(choices))if(!values.includes(c[key]))throw new RangeError('Invalid '+key);
 return c;
}
// Finite authored graph; all edges are positive and the supplied h is consistent.
// Reopen a state on a cheaper path. Test the goal when popped, not when generated.
export function search(strategy){
 if(!['bfs','ucs','astar'].includes(strategy))throw new RangeError('Unknown search strategy');
 const frontier=[{node:'Start',cost:0,path:['Start'],order:0}],best=new Map([['Start',0]]),expanded=[];
 let order=0;
 while(frontier.length){
  const priority=e=>strategy==='bfs'?e.path.length-1:e.cost+(strategy==='astar'?data.heuristic[e.node]:0);
  frontier.sort((a,b)=>priority(a)-priority(b)||a.order-b.order);
  const current=frontier.shift();
  if(strategy!=='bfs'&&current.cost!==best.get(current.node))continue;
  expanded.push(current.node);
  if(current.node==='Ready')return {strategy,path:current.path,cost:current.cost,expanded};
  for(const [node,cost] of data.graph[current.node]){
   const next=current.cost+cost;
   if(best.has(node)&&(strategy==='bfs'||next>=best.get(node)))continue;
   best.set(node,next);frontier.push({node,cost:next,path:[...current.path,node],order:++order});
  }
 }
 return {strategy,path:[],cost:null,expanded};
}
export function evaluate(input={}){
 const config=normalize(input),prior=config.prior/100;
 let yes=1,no=1;
 if(config.evidence==='liked'){yes=data.trailer.liked_if_scifi;no=data.trailer.liked_if_other;}
 if(config.evidence==='disliked'){yes=1-data.trailer.liked_if_scifi;no=1-data.trailer.liked_if_other;}
 const evidenceProbability=prior*yes+(1-prior)*no,posterior=prior*yes/evidenceProbability;
 const rows=data.movies.map(movie=>{
  const reasons=[];
  if(movie.minutes>config.minutes)reasons.push('Too long');
  if(config.offline==='yes'&&!movie.downloaded)reasons.push('Not downloaded');
  const enjoyment=posterior*movie.enjoy_if_scifi+(1-posterior)*movie.enjoy_if_other;
  return {...movie,eligible:reasons.length===0,reasons,enjoyment:round(enjoyment),utility:round(5*enjoyment-config.penalty*(1-enjoyment))};
 });
 // Maximize displayed six-decimal utilities; ties keep abstain, then catalog order.
 let chosen=null,bestUtility=0;
 for(const row of rows)if(row.eligible&&row.utility>bestUtility){chosen=row.id;bestUtility=row.utility;}
 return {config,posterior:round(posterior),evidenceProbability:round(evidenceProbability),eligible:rows.filter(r=>r.eligible).length,chosen,decision:chosen?'recommend':rows.some(r=>r.eligible)?'abstain':'no_feasible_movie',bestUtility,rows,searches:['bfs','ucs','astar'].map(search)};
}
