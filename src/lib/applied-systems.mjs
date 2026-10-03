import data from '../../public/downloads/chapter-39-applications/data.json' with {type:'json'};
export const defaults={threshold:.6,weight:.5,k:2,forecast:'seasonal7'};
export const choices={threshold:[.3,.6,.9],weight:[0,.5,1],k:[2,3],forecast:['last','mean3','seasonal7']};
const round=x=>Math.round(x*1e6)/1e6;
export function normalize(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('Expected a configuration object');
 for(const key of Object.keys(input))if(!Object.hasOwn(defaults,key))throw new RangeError('Unknown option: '+key);
 const c={...defaults,...input};for(const [key,values]of Object.entries(choices))if(!values.includes(c[key]))throw new RangeError('Invalid '+key);return c;
}
export function iou(a,b){
 const intersection=Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0]))*Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1]));
 const union=(a[2]-a[0])*(a[3]-a[1])+(b[2]-b[0])*(b[3]-b[1])-intersection;
 return union>0?intersection/union:0;
}
export function cosine(a,b){const dot=a.reduce((s,x,i)=>s+x*b[i],0),norm=Math.sqrt(a.reduce((s,x)=>s+x*x,0)*b.reduce((s,x)=>s+x*x,0));return norm?dot/norm:0;}
export function detect(threshold,vision=data.vision){
 const used=new Set(),rows=[];
 const sorted=[...vision.predictions].filter(p=>p.score>=threshold).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
 for(const p of sorted){
  const candidates=vision.truth.filter(g=>g.frame===p.frame).map(g=>({...g,overlap:iou(p.box,g.box)})).sort((a,b)=>b.overlap-a.overlap||a.id.localeCompare(b.id));
  const match=candidates.find(g=>g.overlap>=.5&&!used.has(g.id)),best=candidates[0]?.overlap??0;
  if(match)used.add(match.id);
  rows.push({...p,iou:round(match?match.overlap:best),match:match?.id??null,outcome:match?'TP':best>=.5?'FP: duplicate':'FP: no match'});
 }
 const tp=used.size,fp=rows.length-tp,fn=vision.truth.length-tp;
 return {rows,tp,fp,fn,precision:rows.length?round(tp/rows.length):null,recall:vision.truth.length?round(tp/vision.truth.length):null,missed:vision.truth.filter(g=>!used.has(g.id)).map(g=>g.id)};
}
export function recommend(weight,k,recs=data.recommendations){
 // Future relevance labels enter the evaluator only, never the ranking score.
 const eligible=recs.movies.filter(m=>!m.seen&&m.available);
 const scored=eligible.map(m=>{const content=cosine(recs.profile,m.features);return {...m,content,score:weight*content+(1-weight)*m.collaborative};}).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
 const selected=scored.slice(0,k),relevant=eligible.filter(m=>m.relevant).length,hits=selected.filter(m=>m.relevant).length;
 const dcg=selected.reduce((s,m,i)=>s+(m.relevant?1/Math.log2(i+2):0),0);
 const ideal=Array.from({length:Math.min(k,relevant)},(_,i)=>1/Math.log2(i+2)).reduce((a,b)=>a+b,0);
 return {rows:scored.map((m,i)=>({id:m.id,title:m.title,content:round(m.content),collaborative:m.collaborative,score:round(m.score),relevant:m.relevant,selected:i<k})),excluded:recs.movies.filter(m=>m.seen||!m.available).map(m=>({id:m.id,reason:m.seen?'already watched':'unavailable'})),hits,relevant,precision:round(hits/k),recall:relevant?round(hits/relevant):null,ndcg:ideal?round(dcg/ideal):null};
}
export function backtest(method,series=data.demand,startDay=data.evaluationStartDay){
 if(!choices.forecast.includes(method))throw new RangeError('Invalid forecast method');
 const rows=[];
 for(let day=startDay;day<=series.length;day++){
  const origin=day-1,sourceDays=method==='last'?[origin]:method==='mean3'?[origin-2,origin-1,origin]:[day-7];
  if(sourceDays.some(d=>d<1))throw new RangeError('Insufficient history');
  const prediction=sourceDays.reduce((s,d)=>s+series[d-1],0)/sourceDays.length,actual=series[day-1];
  rows.push({day,origin,sourceDays,prediction,actual,error:actual-prediction});
 }
 const mae=rows.reduce((s,r)=>s+Math.abs(r.error),0)/rows.length,rmse=Math.sqrt(rows.reduce((s,r)=>s+r.error*r.error,0)/rows.length);
 return {rows:rows.map(r=>({...r,prediction:round(r.prediction),error:round(r.error)})),mae:round(mae),rmse:round(rmse),horizon:1};
}
export function evaluate(input={}){const config=normalize(input);return {config,vision:detect(config.threshold),recommendations:recommend(config.weight,config.k),forecast:backtest(config.forecast)};}
