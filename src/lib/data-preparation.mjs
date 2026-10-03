import rawRows from '../../public/downloads/chapter-12-data-preparation/raw_watch_events.json' with {type:'json'};
import splitPlan from '../../public/downloads/chapter-12-data-preparation/split_plan.json' with {type:'json'};
export {rawRows,splitPlan};
const columns=['event_id','viewer_id','movie_id','runtime_minutes','genre','liked','review_after'];
const roles=['train','validation','test'];
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
function normalize(row){
  if(!exact(row,columns)||columns.some(k=>typeof row[k]!=='string'))throw new Error('Expected seven text columns.');
  const r=Object.fromEntries(columns.map(k=>[k,row[k].trim()]));
  if(!/^E[0-9]{2}$/.test(r.event_id)||!/^U[0-9]{2}$/.test(r.viewer_id)||!/^M[0-9]{3}$/.test(r.movie_id))throw new Error('Invalid event, viewer, or movie ID.');
  r.genre=r.genre.toLowerCase();if(r.genre==='sci fi')r.genre='sci-fi';
  if(!/^[a-z]+(?:-[a-z]+)*$/.test(r.genre))throw new Error('Invalid genre.');
  const runtime=r.runtime_minutes===''?null:Number(r.runtime_minutes);
  if(runtime!==null&&(!/^[0-9]+$/.test(r.runtime_minutes)||!Number.isInteger(runtime)||runtime<1||runtime>600))throw new Error('Runtime must be blank or whole minutes from 1 to 600.');
  if(!['','0','1'].includes(r.liked))throw new Error('Label must be blank, 0, or 1.');
  return {event_id:r.event_id,viewer_id:r.viewer_id,movie_id:r.movie_id,runtime_minutes:runtime,genre:r.genre,liked:r.liked===''?null:Number(r.liked),review_after:r.review_after};
}
export function cleanRows(input=rawRows){
  if(!Array.isArray(input)||input.length>10000)throw new Error('Supply at most 10000 raw rows.');
  const groups=new Map(),quarantined=[],unlabeled=[];let duplicates=0;
  input.forEach((raw,i)=>{try{const row=normalize(raw);const group=groups.get(row.event_id)||[];group.push({row_number:i+1,row});groups.set(row.event_id,group);}catch(error){quarantined.push({row_number:i+1,event_id:String(raw?.event_id??''),reason:error.message});}});
  const rows=[];
  for(const [id,group] of groups){
    if(new Set(group.map(x=>JSON.stringify(x.row))).size>1){for(const item of group)quarantined.push({row_number:item.row_number,event_id:id,reason:'Conflicting records for one event ID.'});continue;}
    duplicates+=group.length-1;
    const first=group[0];
    if(first.row.liked===null)unlabeled.push({row_number:first.row_number,event_id:id});
    else rows.push(first.row);
  }
  rows.sort((a,b)=>a.event_id<b.event_id?-1:a.event_id>b.event_id?1:0);
  quarantined.sort((a,b)=>a.row_number-b.row_number);
  return {rows,audit:{raw_rows:input.length,kept_rows:rows.length,duplicate_rows:duplicates,quarantined,unlabeled}};
}
export function splitRows(rows,plan=splitPlan){
  if(!exact(plan,roles))throw new Error('Plan needs train, validation, and test viewer lists.');
  const used=new Set();
  for(const role of roles){if(!Array.isArray(plan[role]))throw new Error('Each split needs a viewer list.');for(const id of plan[role]){if(typeof id!=='string'||!/^U[0-9]{2}$/.test(id)||used.has(id))throw new Error('Viewer groups must be valid, distinct, and disjoint.');used.add(id);}}
  /** @type {{train:Array<ReturnType<typeof normalize>>,validation:Array<ReturnType<typeof normalize>>,test:Array<ReturnType<typeof normalize>>}} */
  const splits={train:[],validation:[],test:[]};
  for(const row of rows){const role=roles.find(role=>plan[role].includes(row.viewer_id));if(!role)throw new Error('A kept viewer is missing from the split plan.');splits[role].push(row);}
  return splits;
}
export function fitPreprocessor(rows,strategy='median'){
  if(!['mean','median'].includes(strategy))throw new Error('Choose mean or median.');
  if(!rows.length)throw new Error('No rows to fit.');
  const known=rows.map(r=>r.runtime_minutes).filter(v=>v!==null).sort((a,b)=>a-b);
  if(!known.length)throw new Error('No observed training runtime; choose an explicit alternative.');
  const mid=Math.floor(known.length/2);
  const fill_value=strategy==='mean'?known.reduce((a,b)=>a+b,0)/known.length:(known.length%2?known[mid]:(known[mid-1]+known[mid])/2);
  const values=rows.map(r=>r.runtime_minutes??fill_value);
  const runtime_mean=values.reduce((a,b)=>a+b,0)/values.length;
  const runtime_std=Math.sqrt(values.reduce((sum,x)=>sum+(x-runtime_mean)**2,0)/values.length);
  const genres=[...new Set(rows.map(r=>r.genre))].sort();
  return {strategy,fill_value,runtime_mean,runtime_std,runtime_scale:runtime_std||1,genres,feature_names:['runtime_z','runtime_missing',...genres.map(g=>'genre='+g),'genre=__unknown__']};
}
export function transformRows(rows,state){
  return {event_ids:rows.map(r=>r.event_id),viewer_ids:rows.map(r=>r.viewer_id),X:rows.map(r=>[( (r.runtime_minutes??state.fill_value)-state.runtime_mean)/state.runtime_scale,Number(r.runtime_minutes===null),...state.genres.map(g=>Number(r.genre===g)),Number(!state.genres.includes(r.genre))]),y:rows.map(r=>r.liked)};
}
export function prepareData(strategy='median',scope='train',input=rawRows,plan=splitPlan){
  if(!['train','all'].includes(scope))throw new Error('Choose train or all scope.');
  const cleaned=cleanRows(input),splits=splitRows(cleaned.rows,plan);
  const fitRows=scope==='train'?splits.train:roles.flatMap(role=>splits[role]);
  const state=fitPreprocessor(fitRows,strategy);
  return {pipeline_version:'movie-preparation-v1',split_plan:plan,fit_scope:scope,leakage_demo:scope==='all',audit:cleaned.audit,state,splits,prepared:Object.fromEntries(roles.map(role=>[role,transformRows(splits[role],state)]))};
}
