import data from '../../public/downloads/chapter-31-workflows/data.json' with {type:'json'};
export {data};
export const defaults={scenario:'happy',retries:1,budget:4,canWrite:true,authorized:true,deduplicate:true};
export const contracts={
 lookup_movie:{type:'object',properties:{movie_id:{type:'string',pattern:'^M[0-9]{3}$'},region:{type:'string',enum:['IN','GB']}},required:['movie_id','region'],additionalProperties:false},
 add_to_watchlist:{type:'object',properties:{movie_id:{type:'string',pattern:'^M[0-9]{3}$'}},required:['movie_id'],additionalProperties:false}
};
export class ToolError extends Error{constructor(code,message){super(message);this.code=code;}}
function fail(code,message){throw new ToolError(code,message);}
export function validateCall(name,raw){
 if(!Object.hasOwn(contracts,name))fail('unknown_tool','Tool is outside the allowlist.');
 let args;try{if(typeof raw!=='string')throw Error();args=JSON.parse(raw);}catch{fail('invalid_json','Arguments must be a JSON string encoding an object.');}
 const schema=contracts[name];
 if(!args||Array.isArray(args)||typeof args!=='object'||Object.keys(args).length!==schema.required.length||!schema.required.every(k=>Object.hasOwn(args,k)))fail('invalid_schema','Arguments must contain exactly the required fields.');
 if(typeof args.movie_id!=='string'||!/^M[0-9]{3}$/.test(args.movie_id)||(name==='lookup_movie'&&!['IN','GB'].includes(args.region)))fail('invalid_schema','Movie ID or region has the wrong type or value.');
 return args;
}
// A single-process teaching backend. Durable, atomic storage is needed in production.
export class WatchlistStore{
 constructor(){this.rows=[];this.receipts=new Map();}
 save(user,movie,key,deduplicate=true){
  if(typeof user!=='string'||!user||typeof key!=='string'||!key||!data.movies.some(m=>m.movie_id===movie))fail('invalid_write','Invalid server-side write context.');
  const scoped=JSON.stringify([user,key]),fingerprint=JSON.stringify({movie_id:movie});
  if(deduplicate&&this.receipts.has(scoped)){
   const prior=this.receipts.get(scoped);
   if(prior.fingerprint!==fingerprint)fail('key_conflict','This operation key already belongs to different arguments.');
   return {...prior.receipt,replayed:true};
  }
  this.rows.push({user,movie_id:movie});
  const receipt={receipt_id:`R${this.rows.length}`,movie_id:movie,saved:true};
  if(deduplicate)this.receipts.set(scoped,{fingerprint,receipt});
  return {...receipt,replayed:false};
 }
}
export function runWorkflow(options={}){
 if(!options||Array.isArray(options)||typeof options!=='object'||Object.keys(options).some(k=>!Object.hasOwn(defaults,k)))throw Error('Invalid workflow configuration.');
 const c={...defaults,...options};
 if(!data.scenarios.some(s=>s.id===c.scenario)||![0,1,2].includes(c.retries)||![1,2,3,4].includes(c.budget)||['canWrite','authorized','deduplicate'].some(k=>typeof c[k]!=='boolean'))throw Error('Invalid workflow configuration.');
 const trace=[],store=new WatchlistStore(),user='viewer-1',movie=c.scenario==='unavailable'?'M002':'M001',region='IN',key='request-31-save';
 let attempts=0,ambiguous=false;
 const event=(state,call_id,code,detail)=>trace.push({step:trace.length+1,state,call_id,code,detail});
 const finish=(status,answer)=>({config:c,status,answer,attempts,backendRows:store.rows.map(r=>({...r})),trace});
 const invoke=(name,args,call_id)=>{
  event('proposed',call_id,name,args);
  let parsed;try{parsed=validateCall(name,args);}catch(e){event('blocked',call_id,e.code,e.message);return {stop:'blocked',message:e.message};}
  event('validated',call_id,'schema_ok','Arguments satisfy the local contract.');
  if(!data.movies.some(m=>m.movie_id===parsed.movie_id)){event('blocked',call_id,'unknown_movie','Movie ID does not exist.');return {stop:'blocked',message:'Movie ID does not exist.'};}
  if(name==='add_to_watchlist'){
   if(!c.canWrite){event('blocked',call_id,'permission_denied','Authenticated account lacks write permission.');return {stop:'blocked',message:'Write permission is missing. Nothing was saved.'};}
   if(!c.authorized||parsed.movie_id!==movie){event('blocked',call_id,'intent_mismatch','User authorization does not cover this exact movie.');return {stop:'blocked',message:'This movie action is not authorized. Nothing was saved.'};}
   event('authorized',call_id,'write_allowed','Account permission and exact movie intent match.');
  }
  for(let attempt=0;attempt<=c.retries;attempt++){
   if(attempts>=c.budget){event('stopped',call_id,'budget_exhausted','No execution attempts remain.');return {stop:ambiguous?'needs_reconciliation':'budget_exhausted',message:ambiguous?'Save outcome is unknown. Check the operation receipt before trying again.':'Attempt budget reached. Nothing was saved.'};}
   attempts++;event('executing',call_id,'attempt',`Attempt ${attempt+1}; total ${attempts}.`);
   if(name==='lookup_movie'){
    if(c.scenario==='read_timeout'&&attempt===0){event('error',call_id,'read_timeout','No lookup result arrived.');}
    else{
     const row=data.movies.find(m=>m.movie_id===parsed.movie_id);
     const result={movie_id:c.scenario==='bad_result'?'M002':row.movie_id,title:row.title,available:row.regions.includes(parsed.region),region:parsed.region};
     if(result.movie_id!==parsed.movie_id){event('blocked',call_id,'invalid_result','Returned movie does not match the requested movie.');return {stop:'failed',message:'Lookup returned inconsistent evidence. Nothing was saved.'};}
     event('result',call_id,'lookup_ok',JSON.stringify(result));return {result};
    }
   }else{
    const receipt=store.save(user,parsed.movie_id,key,c.deduplicate);
    if(c.scenario==='lost_receipt'&&attempt===0){ambiguous=true;event('error',call_id,'write_timeout','No save receipt arrived; commit status is unknown to the caller.');}
    else{ambiguous=false;event('result',call_id,receipt.replayed?'receipt_replayed':'save_ok',JSON.stringify(receipt));return {result:receipt};}
   }
   if(attempt<c.retries)event('retry',call_id,'retry_scheduled',`Simulated backoff ${2**attempt} s; reuse the same operation key.`);
  }
  return {stop:ambiguous?'needs_reconciliation':'failed',message:ambiguous?'Save outcome is unknown. Check the operation receipt before trying again.':'Lookup failed after the allowed attempts. Nothing was saved.'};
 };
 let lookupName='lookup_movie',lookupArgs=JSON.stringify({movie_id:movie,region});
 if(c.scenario==='bad_json')lookupArgs='{"movie_id":';
 if(c.scenario==='extra_field')lookupArgs=JSON.stringify({movie_id:movie,region,user:'someone-else'});
 if(c.scenario==='unknown_tool')lookupName='delete_account';
 if(c.scenario==='unknown_movie')lookupArgs=JSON.stringify({movie_id:'M999',region});
 const lookup=invoke(lookupName,lookupArgs,'call-lookup');
 if(lookup.stop)return finish(lookup.stop,lookup.message);
 if(!lookup.result.available){event('stopped','call-lookup','not_available','Regional availability condition is false.');return finish('not_available','Neon Chase is unavailable in the IN teaching catalog. Nothing was saved.');}
 const saved=invoke('add_to_watchlist',JSON.stringify({movie_id:c.scenario==='changed_movie'?'M002':movie}),'call-save');
 if(saved.stop)return finish(saved.stop,saved.message);
 event('completed','call-save','verified_receipt','Final message is based on the received save receipt.');
 return finish('completed',`${lookup.result.title} was saved to your watchlist.`);
}
