import data from '../../public/downloads/chapter-42-capstone/data.json' with {type:'json'};
export {data};
export const defaults={constraints:true,aliases:true,tool:'online'};
export const choices={constraints:[true,false],aliases:[true,false],tool:['online','timeout']};
function configuration(options={}){
  if(!options||typeof options!=='object'||Array.isArray(options))throw new Error('Invalid configuration');
  const config={...defaults,...options};
  for(const [key,value] of Object.entries(config))if(!choices[key]?.includes(value))throw new Error('Invalid configuration: '+key);
  return config;
}
function valid(request){
  if(!request||typeof request!=='object'||Array.isArray(request)||typeof request.intent!=='string')return false;
  const allowed=request.intent==='recommend'?['intent','query','max_minutes','seen']:request.intent==='availability'?['intent','movie_id','region']:['intent','movie_id'];
  if(Object.keys(request).some(k=>!allowed.includes(k)))return false;
  if(request.intent==='recommend')return typeof request.query==='string'&&request.query.length<=200&&/[a-z0-9]/i.test(request.query)&&Number.isInteger(request.max_minutes)&&request.max_minutes>0&&request.max_minutes<=600&&Array.isArray(request.seen)&&request.seen.every(x=>typeof x==='string');
  return typeof request.movie_id==='string'&&(request.intent!=='availability'||typeof request.region==='string'&&/^[A-Z]{2}$/.test(request.region));
}
export function run(request,options={}){
  const config=configuration(options),trace=[],candidates=[];
  const finish=(status,answer,movie=null,value=null,sources=[])=>({status,answer,movie_id:movie?.id??null,value,sources,trace,candidates});
  if(!valid(request))return finish('invalid_input','Supply a valid structured request.');
  trace.push('Validated request; route: '+request.intent+'.');
  if(!['recommend','runtime','availability'].includes(request.intent))return finish('unsupported_question','This assistant supports recommendations, runtimes, and fixture availability.');
  if(request.intent==='recommend'){
    const raw=request.query.toLowerCase().match(/[a-z0-9]+/g)||[];
    const tokens=[...new Set(raw.map(t=>config.aliases?(data.aliases[t]??t):t))];
    trace.push('Query tokens: '+tokens.join(', ')+'.');
    for(const movie of data.movies){
      const score=tokens.filter(t=>movie.tags.includes(t)).length;
      const reasons=[];
      if(movie.minutes>request.max_minutes)reasons.push('over runtime limit');
      if(request.seen.includes(movie.id))reasons.push('already seen');
      candidates.push({id:movie.id,title:movie.title,minutes:movie.minutes,score,eligible:!config.constraints||reasons.length===0,reasons});
    }
    const ranked=candidates.filter(c=>c.eligible&&c.score>0).sort((a,b)=>b.score-a.score);
    trace.push(config.constraints?'Applied runtime and seen filters before ranking.':'DEMO: hard constraints bypassed.');
    trace.push('Ranked by tag overlap; ties keep catalog order.');
    if(!ranked.length)return finish('no_match','No matching movie meets this search configuration.');
    const movie=data.movies.find(m=>m.id===ranked[0].id);
    return finish('ok',`${movie.title} (${movie.minutes} minutes) matches ${tokens.filter(t=>movie.tags.includes(t)).join(', ')}.`,movie,movie.minutes,[movie.source]);
  }
  const movie=data.movies.find(m=>m.id===request.movie_id);
  if(!movie)return finish('not_found','That movie ID is not in this catalog.');
  if(request.intent==='runtime'){
    trace.push('Read minutes directly from the versioned catalog card.');
    return finish('ok',`${movie.title} runs for ${movie.minutes} minutes.`,movie,movie.minutes,[movie.source]);
  }
  trace.push(`Called read-only availability fixture for ${movie.id} / ${request.region}.`);
  if(config.tool==='timeout')return finish('tool_unavailable','Availability lookup timed out; no availability claim can be made.');
  const record=data.availability.find(a=>a.movie_id===movie.id&&a.region===request.region);
  if(!record)return finish('unknown_availability','No availability record for this movie and region.');
  return finish('ok',`Fixture only: ${movie.title} is listed on ${record.service} in ${record.region}, as of ${record.as_of}.`,movie,record.service,[record.source]);
}
export function evaluate(options={}){
  const config=configuration(options);
  const rows=data.cases.map(c=>{
    const result=run(c.request,config),movie=data.movies.find(m=>m.id===result.movie_id);
    const constraintsOk=c.request.intent!=='recommend'||!movie||(movie.minutes<=c.request.max_minutes&&!c.request.seen.includes(movie.id));
    const record=data.availability.find(a=>a.movie_id===result.movie_id&&a.region===c.request.region);
    const evidenceOk=result.status!=='ok'||(c.request.intent==='availability'?!!record&&result.value===record.service&&result.sources.length===1&&result.sources[0]===record.source:!!movie&&result.value===movie.minutes&&result.sources.length===1&&result.sources[0]===movie.source);
    const matched=Object.entries(c.expected).every(([k,v])=>result[k]===v);
    return {id:c.id,label:c.label,slice:c.slice,expected:c.expected,result,constraintsOk,evidenceOk,passed:matched&&constraintsOk&&evidenceOk};
  });
  const passed=rows.filter(r=>r.passed).length,violations=rows.filter(r=>!r.constraintsOk).length,toolFailures=rows.filter(r=>r.result.status==='tool_unavailable').length;
  const evidenceFailures=rows.filter(r=>!r.evidenceOk).length;
  return {version:data.version,config,passed,total:rows.length,rate:passed/rows.length,violations,toolFailures,evidenceFailures,gate:passed===rows.length&&violations===0&&toolFailures===0&&evidenceFailures===0?'Passes demo gate':'Needs work',rows};
}
