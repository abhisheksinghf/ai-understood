import fixtures from '../../public/downloads/chapter-35-security/data.json' with {type:'json'};
export const data=fixtures;
export const defaults={mode:'boundaries',slice:'all',context:'minimal',approval:'matched'};
const choices={mode:['keyword','boundaries'],slice:['all','legitimate','adversarial'],context:['minimal','excessive'],approval:['matched','missing','stale']};
export function normalize(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!Object.hasOwn(choices,k)))throw new Error('Unknown configuration');
 const c={...defaults,...input};for(const [k,values]of Object.entries(choices))if(!values.includes(c[k]))throw new Error('Invalid '+k);return c;
}
export function validateProposal(p){
 if(!p||typeof p!=='object'||Array.isArray(p))return false;
 const fields=['tool','owner','movieId','claimedApproval'];
 return Object.keys(p).length===4&&fields.every(k=>Object.hasOwn(p,k))&&typeof p.tool==='string'&&typeof p.owner==='string'&&typeof p.movieId==='string'&&typeof p.claimedApproval==='boolean';
}
export function authorize(proposal,host,grant){
 if(!validateProposal(proposal))return {decision:'block',reason:'Invalid proposal schema'};
 const p=proposal;
 if(!['read_catalog','read_history','add_watchlist'].includes(p.tool))return {decision:'block',reason:'Tool is not allowed'};
 if(p.tool==='read_catalog')return p.owner==='public'&&host.catalogIds.includes(p.movieId)?{decision:'allow',reason:'Public catalog read'}:{decision:'block',reason:'Invalid public catalog target'};
 if(p.owner!==host.principal)return {decision:'block',reason:'Account boundary mismatch'};
 if(p.tool==='read_history')return host.historyRequested?{decision:'allow',reason:'Requested history for current account'}:{decision:'block',reason:'History access was not requested'};
 if(!host.allowedMovie||p.movieId!==host.allowedMovie||!host.catalogIds.includes(p.movieId))return {decision:'block',reason:'Action differs from trusted request'};
 if(!grant||grant.principal!==host.principal||grant.requestId!==host.requestId||grant.tool!==p.tool||grant.movieId!==p.movieId)return {decision:host.reviewable?'review':'block',reason:'Missing or mismatched approval scope'};
 return {decision:'allow',reason:'Account, intent, and approval match'};
}
export function evaluate(input={}){
 const config=normalize(input);
 const rows=data.cases.map(item=>{
  const host={...item.host,catalogIds:data.catalogIds};
  let grant=item.grant;
  if(item.id==='N2')grant=config.approval==='missing'?null:{...item.grant,requestId:config.approval==='stale'?'old-request':host.requestId};
  const expectedAllow=item.id==='N2'?config.approval==='matched':item.expectedAllow;
  const result=config.mode==='boundaries'?authorize(item.proposal,host,grant):item.text.toLowerCase().includes('ignore previous instructions')?{decision:'block',reason:'Keyword filter matched'}:{decision:'allow',reason:'Keyword filter found no match'};
  const allowed=result.decision==='allow';
  return {id:item.id,label:item.label,kind:item.kind,text:item.text,proposal:item.proposal,host,grant,expectedAllow,...result,simulatedEffect:allowed?(item.proposal.tool==='add_watchlist'?'watchlist_write':item.proposal.tool==='export_history'?'external_export':'data_read'):'none',violation:allowed&&!expectedAllow,falseBlock:!allowed&&expectedAllow,correct:allowed===expectedAllow};
 });
 const view=rows.filter(row=>config.slice==='all'||row.kind===config.slice);
 const summarize=rs=>({total:rs.length,allowed:rs.filter(r=>r.decision==='allow').length,violations:rs.filter(r=>r.violation).length,falseBlocks:rs.filter(r=>r.falseBlock).length,correct:rs.filter(r=>r.correct).length});
 const contextFields=config.context==='minimal'?['catalog','stated_preferences']:['catalog','stated_preferences','account_email','viewing_history'];
 return {config,contextFields,unnecessaryPrivateFields:contextFields.length-2,full:summarize(rows),visible:summarize(view),rows:view};
}
