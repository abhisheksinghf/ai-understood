import data from '../../public/downloads/chapter-33-coordination/data.json' with {type:'json'};
export {data};
export const defaults={scenario:'normal',pattern:'manager',schedule:'parallel',budget:3,validate:true};
const copy=x=>JSON.parse(JSON.stringify(x));
export function validateConfig(input={}){
 const c={...defaults,...input};
 if(Object.keys(input).some(k=>!Object.hasOwn(defaults,k))||!data.scenarios.some(s=>s.id===c.scenario)||!['manager','handoff'].includes(c.pattern)||!['parallel','sequential'].includes(c.schedule)||![1,2,3].includes(c.budget)||typeof c.validate!=='boolean')throw new Error('Invalid experiment configuration');
 return c;
}
export function availabilityReport(scenario){
 return {worker:'availability',status:scenario==='missing'?'timeout':'ok',region:scenario==='wrong_region'?'US':data.region,version:scenario==='stale'?'catalog-v1':data.version,source:'availability-fixture',records:scenario==='missing'?[]:[{movie_id:'M001',available:false},{movie_id:'M003',available:true},...(scenario==='conflict'?[{movie_id:'M003',available:false}]:[])]};
}
export function verifyAvailability(report,movieId){
 if(!report||report.status!=='ok')return {ok:false,reason:'Availability is missing; unknown is not unavailable.'};
 if(report.region!==data.region)return {ok:false,reason:'Availability region does not match IN.'};
 if(report.version!==data.version)return {ok:false,reason:'Availability snapshot does not match catalog-v2.'};
 if(report.source!=='availability-fixture'||!Array.isArray(report.records)||report.records.some(r=>!r||!data.movies.some(m=>m.id===r.movie_id)||typeof r.available!=='boolean'))return {ok:false,reason:'Availability records fail the result contract.'};
 const rows=report.records.filter(r=>r.movie_id===movieId);
 if(!rows.length)return {ok:false,reason:'No availability record for this movie.'};
 if(new Set(rows.map(r=>r.available)).size>1)return {ok:false,reason:'Matching records disagree; resolve the conflict.'};
 return {ok:rows[0].available,reason:rows[0].available?'Matching evidence verifies availability.':'Movie is unavailable in this snapshot.'};
}
export function runCoordination(input={}){
 const config=validateConfig(input),owner=config.pattern==='manager'?'Manager':'Movie specialist';
 const jobs=[{worker:'catalog',start:0,end:2,owner:'Manager'}];
 const reports={catalog:{worker:'catalog',status:'ok',version:data.version,movies:copy(data.movies)}};
 if(config.budget>=2){jobs.push({worker:'availability',start:2,end:5,owner});reports.availability=availabilityReport(config.scenario);}
 if(config.budget>=3){const start=config.schedule==='parallel'?2:5;jobs.push({worker:'taste',start,end:start+2,owner});reports.taste={worker:'taste',status:'ok',version:data.version,ranking:copy(data.ranking),source:'taste-fixture',reason:'Harbor Lights has the gentler pace in our fictional review notes.'};}
 const notes=[],suggested=reports.taste?.ranking[0]||null;
 let chosen=null,status='incomplete';
 if(!reports.taste)notes.push('Taste report was not scheduled: specialist-job budget reached.');
 if(!reports.availability)notes.push('Availability report was not scheduled: specialist-job budget reached.');
 const check=suggested?verifyAvailability(reports.availability,suggested):null;
 if(suggested){
  if(config.validate){if(check.ok){chosen=suggested;status='verified';}else{status='insufficient_evidence';notes.push(check.reason);}}
  else{chosen=suggested;status=check.ok?'accepted_unchecked':'unsupported';notes.push('Checks bypassed: the coordinator trusts the taste suggestion without verifying availability.');if(!check.ok)notes.push(check.reason);}
 }
 const elapsed=Math.max(...jobs.map(j=>j.end))+data.durations.final;
 const movie=data.movies.find(m=>m.id===chosen);
 const answer=movie?`${movie.title}, ${movie.minutes} minutes, for India. ${config.validate?'Availability verified in the fixture.':'This unchecked answer may lack supporting evidence.'}`:'No recommendation finalized. Complete or repair the missing evidence first.';
 return {config,owner,status,chosen,answer,jobs,reports,notes,elapsed,jobCount:jobs.length,workUnits:jobs.reduce((s,j)=>s+j.end-j.start,0)+1,handoffs:config.pattern==='handoff'?1:0};
}
export function protocolTranscript(){
 const tool={name:'check_availability',description:'Read fictional regional availability.',inputSchema:{type:'object',properties:{movie_id:{type:'string'},region:{type:'string'}},required:['movie_id','region'],additionalProperties:false}};
 return [
  {jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'movie-host',version:'1.0.0'}}},
  {jsonrpc:'2.0',id:1,result:{protocolVersion:'2025-11-25',capabilities:{tools:{}},serverInfo:{name:'movie-server',version:'1.0.0'}}},
  {jsonrpc:'2.0',method:'notifications/initialized'},
  {jsonrpc:'2.0',id:2,method:'tools/list',params:{}},
  {jsonrpc:'2.0',id:2,result:{tools:[tool]}},
  {jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'check_availability',arguments:{movie_id:'M003',region:'IN'}}},
  {jsonrpc:'2.0',id:3,result:{content:[{type:'text',text:'M003 is available in IN in this fictional snapshot.'}],isError:false}}
 ];
}

