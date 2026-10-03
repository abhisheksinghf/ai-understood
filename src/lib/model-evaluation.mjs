import dataset from '../../public/downloads/chapter-15-model-evaluation/movie_predictions.json' with {type:'json'};
export {dataset};
export const THRESHOLDS=[.4,.5,.6,.7,.85];
export const COSTS={equal:{fp:1,fn:1},misses:{fp:1,fn:3},unwanted:{fp:3,fn:1}};
export const EPSILON=1e-15;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const ratio=(a,b)=>b===0?null:a/b;
export function validateDataset(data=dataset){
  if(!exact(data,['version','training_summary','rows'])||data.version!=='movie-evaluation-v1'||!Array.isArray(data.rows)||data.rows.length>1000)throw new Error('Expected a versioned evaluation snapshot with at most 1000 events.');
  const s=data.training_summary;
  if(!exact(s,['positive','total'])||!Number.isInteger(s.total)||s.total<1||s.total>100000||!Number.isInteger(s.positive)||s.positive<0||s.positive>s.total)throw new Error('Training summary needs integer counts with 0 <= positive <= total.');
  const ids=new Set(),viewers=new Map();
  /** @type {{validation:typeof dataset.rows,test:typeof dataset.rows,baseline_probability:number}} */
  const splits={validation:[],test:[],baseline_probability:s.positive/s.total};
  for(const r of data.rows){
    if(!exact(r,['event_id','viewer_id','split','movie','prior_ratings','liked','a','b'])||typeof r.event_id!=='string'||!/^E[0-9]{3}$/.test(r.event_id)||typeof r.viewer_id!=='string'||!/^V[0-9]{3}$/.test(r.viewer_id)||ids.has(r.event_id)||!['validation','test'].includes(r.split)||typeof r.movie!=='string'||!r.movie.trim()||r.movie.length>100||!Number.isInteger(r.prior_ratings)||r.prior_ratings<0||r.prior_ratings>10000||!finite(r.liked)||![0,1].includes(r.liked)||![r.a,r.b].every(p=>finite(p)&&p>=0&&p<=1))throw new Error('Invalid event, label, probability, history count, or duplicate ID.');
    if(viewers.has(r.viewer_id)&&viewers.get(r.viewer_id)!==r.split)throw new Error('A viewer cannot cross validation and test boundaries.');
    ids.add(r.event_id);viewers.set(r.viewer_id,r.split);splits[r.split].push(r);
  }
  if(!splits.validation.length||!splits.test.length)throw new Error('Validation and test splits must both contain events.');
  return splits;
}
export function rocCurve(labels,scores){
  const positives=labels.reduce((s,y)=>s+y,0),negatives=labels.length-positives;
  if(!positives||!negatives)return null;
  const order=scores.map((p,i)=>({p,y:labels[i]})).sort((a,b)=>b.p-a.p);
  const points=[{fpr:0,tpr:0}];let tp=0,fp=0,i=0;
  while(i<order.length){const score=order[i].p;while(i<order.length&&order[i].p===score){if(order[i].y)tp++;else fp++;i++;}points.push({fpr:fp/negatives,tpr:tp/positives});}
  return points;
}
/** @param {typeof dataset.rows} rows */
export function evaluateRows(rows,candidate='a',threshold=.5,cost='misses',baselineProbability=.25){
  if(!rows.length||!['a','b','baseline'].includes(candidate)||!finite(threshold)||threshold<0||threshold>1||!Object.hasOwn(COSTS,cost)||!finite(baselineProbability)||baselineProbability<0||baselineProbability>1)throw new Error('Choose a supported candidate, threshold, cost policy, and nonempty rows.');
  let tp=0,fp=0,tn=0,fn=0,loss=0,brier=0;
  const predictions=rows.map(r=>{
    const p=candidate==='baseline'?baselineProbability:r[candidate],decision=Number(p>=threshold);
    const outcome=decision?(r.liked?'TP':'FP'):(r.liked?'FN':'TN');
    if(outcome==='TP')tp++;else if(outcome==='FP')fp++;else if(outcome==='TN')tn++;else fn++;
    const clipped=Math.min(1-EPSILON,Math.max(EPSILON,p));
    loss+=r.liked?-Math.log(clipped):-Math.log1p(-clipped);brier+=(p-r.liked)**2;
    return {event_id:r.event_id,movie:r.movie,prior_ratings:r.prior_ratings,liked:r.liked,probability:p,predicted:decision,outcome};
  });
  const n=rows.length,recall=ratio(tp,tp+fn),specificity=ratio(tn,tn+fp),roc=rocCurve(rows.map(r=>r.liked),predictions.map(r=>r.probability));
  const auc=roc?roc.slice(1).reduce((sum,p,i)=>sum+(p.fpr-roc[i].fpr)*(p.tpr+roc[i].tpr)/2,0):null;
  return {n,positives:tp+fn,prevalence:(tp+fn)/n,confusion:{tp,fp,tn,fn},accuracy:(tp+tn)/n,precision:ratio(tp,tp+fp),recall,specificity,fpr:ratio(fp,fp+tn),f1:ratio(2*tp,2*tp+fp+fn),balanced_accuracy:recall===null||specificity===null?null:(recall+specificity)/2,total_cost:fp*COSTS[cost].fp+fn*COSTS[cost].fn,cost_per_event:(fp*COSTS[cost].fp+fn*COSTS[cost].fn)/n,log_loss:loss/n,brier:brier/n,auc,roc,rows:predictions};
}
export function selectOnValidation(rows,cost,baselineProbability){
  const comparison=[];
  for(const candidate of ['a','b'])for(const threshold of THRESHOLDS){const r=evaluateRows(rows,candidate,threshold,cost,baselineProbability);comparison.push({candidate,threshold,total_cost:r.total_cost,accuracy:r.accuracy,precision:r.precision,recall:r.recall});}
  const winner=comparison.reduce((best,row)=>row.total_cost<best.total_cost?row:best);
  return {scope:'all validation events',objective:'minimum total weighted error cost',tie_break:'first in fixed order: candidate A then B; thresholds ascending',comparison,winner};
}
export function experiment(candidate='a',threshold=.5,slice='all',cost='misses',data=dataset,evaluateTest=false){
  if(!['all','short','long'].includes(slice)||typeof evaluateTest!=='boolean')throw new Error('Choose an all/short/long history slice and a boolean test flag.');
  const splits=validateDataset(data),rows=splits.validation.filter(r=>slice==='all'||(slice==='short'?r.prior_ratings<5:r.prior_ratings>=5));
  const validation=evaluateRows(rows,candidate,threshold,cost,splits.baseline_probability),selection=selectOnValidation(splits.validation,cost,splits.baseline_probability);
  const result={dataset_version:data.version,provenance:'authored frozen predictions; no model is trained',configuration:{candidate,threshold,slice,cost,costs:COSTS[cost]},baseline_probability:splits.baseline_probability,validation,selection};
  if(evaluateTest){const {candidate,threshold}=selection.winner;return {...result,final_test:{configuration:{candidate,threshold,cost},report:evaluateRows(splits.test,candidate,threshold,cost,splits.baseline_probability)}};}
  return result;
}
