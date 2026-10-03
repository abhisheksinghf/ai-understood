import catalog from '../../public/downloads/chapter-11-movie-project/catalog.json' with {type:'json'};
export {catalog};
export const topics=['any','learning','data','search','math','optimization'];
/** @type {{topic:string,max_minutes:number,prefer_introductory:boolean,completed_ids:string[]}} */
export const defaultPreferences={topic:'learning',max_minutes:30,prefer_introductory:true,completed_ids:[]};
const nonempty=value=>typeof value==='string'&&!!value.trim();
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));
export function validateCatalog(data){
  if(!exact(data,['version','notes'])||!nonempty(data.version)||!Array.isArray(data.notes)||data.notes.length>100)throw new Error('Catalog needs a version and at most 100 note records.');
  const ids=new Set();
  for(const m of data.notes){
    if(!exact(m,['id','title','topics','level','estimated_minutes','exam_date','text'])||!/^N[0-9]{2}$/.test(m.id)||ids.has(m.id)||(!nonempty(m.title)||!nonempty(m.text)))throw new Error('Note fields, IDs, or title are invalid.');
    if(!Array.isArray(m.topics)||!m.topics.length||new Set(m.topics).size!==m.topics.length||m.topics.some(g=>!topics.slice(1).includes(g)))throw new Error('Note topics must be distinct known topics.');
    if(!['introductory','advanced'].includes(m.level)||!(m.estimated_minutes===null||(Number.isInteger(m.estimated_minutes)&&m.estimated_minutes>0&&m.estimated_minutes<=600))||!(m.exam_date===null||nonempty(m.exam_date)))throw new Error('Note level, study-time estimate, or exam date is invalid.');
    ids.add(m.id);
  }
}
export function validatePreferences(p,data=catalog){
  if(!exact(p,['topic','max_minutes','prefer_introductory','completed_ids'])||!topics.includes(p.topic)||!Number.isInteger(p.max_minutes)||p.max_minutes<5||p.max_minutes>120||typeof p.prefer_introductory!=='boolean'||!Array.isArray(p.completed_ids)||p.completed_ids.some(id=>typeof id!=='string'||!data.notes.some(m=>m.id===id))||new Set(p.completed_ids).size!==p.completed_ids.length)throw new Error('Choose a known topic, whole minutes from 5 to 120, an introductory-level preference, and distinct known completed IDs.');
}
export function recommend(p=defaultPreferences,data=catalog){
  validateCatalog(data);validatePreferences(p,data);
  const decisions=data.notes.map(m=>{
    const reasons=[];
    if(p.topic!=='any'&&!m.topics.includes(p.topic))reasons.push('Topic does not match');
    if(m.estimated_minutes===null)reasons.push('Study-time estimate unknown');
    else if(m.estimated_minutes>p.max_minutes)reasons.push('Over time limit');
    if(p.completed_ids.includes(m.id))reasons.push('Already completed');
    return {note_id:m.id,title:m.title,eligible:!reasons.length,reasons,score:!reasons.length?Number(p.prefer_introductory&&m.level==='introductory'):null};
  });
  const eligible=data.notes.filter(m=>decisions.find(d=>d.note_id===m.id).eligible);
  eligible.sort((a,b)=>Number(p.prefer_introductory&&b.level==='introductory')-Number(p.prefer_introductory&&a.level==='introductory')||a.estimated_minutes-b.estimated_minutes||(a.id<b.id?-1:a.id>b.id?1:0));
  const m=eligible[0];
  const recommendation=m?{note_id:m.id,title:m.title,topics:m.topics,level:m.level,estimated_minutes:m.estimated_minutes,exam_date:m.exam_date,text:m.text,
    reason:`${m.title} has an estimated study time of ${m.estimated_minutes} minutes, within your ${p.max_minutes}-minute limit. Topic: ${m.topics.join(', ')}. Level: ${m.level}. Selected by the stated ranking rule; learning benefit is not guaranteed.`}:null;
  return {status:m?'ok':'no_match',catalog_version:data.version,request:p,recommendation,eligible_ids:eligible.map(m=>m.id),decisions};
}
