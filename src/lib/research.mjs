import data from '../../public/downloads/chapter-41-research/data.json' with {type:'json'};
export const defaults={scope:'all',overlap:'keep',sample:25,protocol:'matched',remove:'retrieval'};
export const choices={scope:['all','facts','preferences','tools'],overlap:['keep','exclude'],sample:[25,100,400],protocol:['matched','unequal'],remove:['retrieval','reranker','both']};
const round=x=>Math.round(x*1e6)/1e6;
export function normalize(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('Expected a configuration object');
 for(const k of Object.keys(input))if(!Object.hasOwn(defaults,k))throw new RangeError('Unknown option: '+k);
 const c={...defaults,...input};for(const [k,vs]of Object.entries(choices))if(!vs.includes(c[k]))throw new RangeError('Invalid '+k);return c;
}
export function audit(scope,overlap,cases=data.cases){
 const rows=cases.filter(r=>scope==='all'||r.task===scope).map(r=>({...r,included:overlap==='keep'||!r.overlap}));
 const included=rows.filter(r=>r.included),n=included.length;
 const baseline=included.reduce((s,r)=>s+r.baseline,0),candidate=included.reduce((s,r)=>s+r.candidate,0);
 const wins=included.filter(r=>r.candidate>r.baseline).length,losses=included.filter(r=>r.candidate<r.baseline).length;
 return {rows,n,excluded:rows.length-n,baseline,candidate,baselineRate:n?round(baseline/n):null,candidateRate:n?round(candidate/n):null,difference:n?round((candidate-baseline)/n):null,wins,losses,ties:n-wins-losses};
}
export function wilson(passed,n){
 if(!Number.isInteger(n)||!Number.isInteger(passed)||n<0||passed<0||passed>n)throw new RangeError('Invalid counts');
 if(!n)return {rate:null,low:null,high:null,width:null};
 const p=passed/n,z=1.96,z2=z*z,den=1+z2/n,center=(p+z2/(2*n))/den,half=z*Math.sqrt(p*(1-p)/n+z2/(4*n*n))/den;
 const low=Math.max(0,center-half),high=Math.min(1,center+half);
 return {rate:round(p),low:round(low),high:round(high),width:round(high-low)};
}
export function uncertainty(sample){
 const rows=data.samples.map(s=>({...s,...wilson(s.passed,s.n),selected:s.n===sample}));
 return {rows,selected:rows.find(s=>s.selected)};
}
export function ablate(protocol,remove,variants=data.ablations){
 const target={retrieval:'reranker',reranker:'retrieval',both:'neither'}[remove];
 const rows=variants.map(r=>{const v=protocol==='unequal'&&r.id==='full'?{...r,passed:90,budget:3000}:{...r};return {...v,rate:round(v.passed/v.n),selected:v.id==='full'||v.id===target};});
 const full=rows.find(r=>r.id==='full'),ablated=rows.find(r=>r.id===target),matched=full.budget===ablated.budget;
 const rate=id=>rows.find(r=>r.id===id).rate;
 return {rows,full,ablated,matched,contrast:round(full.rate-ablated.rate),interaction:protocol==='matched'?round(rate('full')-rate('retrieval')-rate('reranker')+rate('neither')):null};
}
export function evaluate(input={}){const config=normalize(input);return {config,audit:audit(config.scope,config.overlap),uncertainty:uncertainty(config.sample),ablation:ablate(config.protocol,config.remove)};}
