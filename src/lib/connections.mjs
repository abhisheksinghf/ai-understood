import data from '../../public/downloads/chapter-40-connections/data.json' with {type:'json'};
export const defaults={steps:1,topology:'chain',allocation:'unbalanced',targetHigh:.5,strategy:'uncertain',budget:2};
export const choices={steps:[0,1,3],topology:['chain','shortcut'],allocation:['unbalanced','balanced'],targetHigh:[.25,.5,.75],strategy:['uncertain','confident'],budget:[1,2]};
const round=x=>Math.round(x*1e6)/1e6;
export function normalize(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('Expected a configuration object');
 for(const k of Object.keys(input))if(!Object.hasOwn(defaults,k))throw new RangeError('Unknown option: '+k);
 const c={...defaults,...input};for(const [k,vs]of Object.entries(choices))if(!vs.includes(c[k]))throw new RangeError('Invalid '+k);return c;
}
export function propagate(steps,topology,graph=data.graph){
 const edges=topology==='shortcut'?[...graph.edges,graph.shortcut]:[...graph.edges];
 const neighbors=Object.fromEntries(graph.nodes.map(n=>[n.id,[]]));for(const [a,b]of edges){neighbors[a].push(b);neighbors[b].push(a);}
 let values=Object.fromEntries(graph.nodes.map(n=>[n.id,n.value]));
 const history=[{step:0,values:{...values}}],updates=[];
 for(let step=1;step<=steps;step++){
  const next={};for(const n of graph.nodes){const ids=neighbors[n.id],old=values[n.id];const mean=ids.length?ids.reduce((s,id)=>s+values[id],0)/ids.length:null;next[n.id]=mean===null?old:.5*old+.5*mean;updates.push({step,id:n.id,neighbors:[...ids],old:round(old),neighborMean:mean===null?null:round(mean),updated:round(next[n.id])});}
  values=next;history.push({step,values:Object.fromEntries(Object.entries(values).map(([k,v])=>[k,round(v)]))});
 }
 return {edges,rows:graph.nodes.map(n=>({...n,neighbors:neighbors[n.id],final:round(values[n.id])})),history,updates};
}
export function standardize(allocation,targetHigh,tables=data.causal){
 const rows=tables[allocation].map((r,i)=>({...r,weight:i===0?targetHigh:1-targetHigh,withRate:r.withY/r.withN,withoutRate:r.withoutY/r.withoutN}));
 const total=key=>rows.reduce((s,r)=>s+r[key],0);
 const crudeWith=total('withY')/total('withN'),crudeWithout=total('withoutY')/total('withoutN');
 const adjustedWith=rows.reduce((s,r)=>s+r.weight*r.withRate,0),adjustedWithout=rows.reduce((s,r)=>s+r.weight*r.withoutRate,0);
 return {rows:rows.map(r=>({...r,withRate:round(r.withRate),withoutRate:round(r.withoutRate),difference:round(r.withRate-r.withoutRate)})),crudeWith:round(crudeWith),crudeWithout:round(crudeWithout),crudeDifference:round(crudeWith-crudeWithout),adjustedWith:round(adjustedWith),adjustedWithout:round(adjustedWithout),adjustedDifference:round(adjustedWith-adjustedWithout)};
}
export function entropy(p){if(p===0||p===1)return 0;return -p*Math.log2(p)-(1-p)*Math.log2(1-p);}
export function queryReviews(strategy,budget,reviews=data.reviews){
 // Selection uses predictions only. Six-decimal entropy keys give explicit stable ties.
 const scored=reviews.map(r=>({id:r.id,text:r.text,p:r.p,entropy:round(entropy(r.p))})).sort((a,b)=>(strategy==='uncertain'?b.entropy-a.entropy:a.entropy-b.entropy)||a.id.localeCompare(b.id));
 const selected=scored.slice(0,budget).map(r=>r.id);
 const rows=scored.map(r=>({...r,selected:selected.includes(r.id),annotation:selected.includes(r.id)?reviews.find(x=>x.id===r.id).label:null}));
 return {rows,selected,labelsRequested:selected.length,meanEntropy:round(rows.filter(r=>r.selected).reduce((s,r)=>s+r.entropy,0)/selected.length)};
}
export function evaluate(input={}){const config=normalize(input);return {config,graph:propagate(config.steps,config.topology),causal:standardize(config.allocation,config.targetHigh),active:queryReviews(config.strategy,config.budget)};}
