import data from '../../public/downloads/chapter-23-language/data.json' with {type:'json'};
export {data};
const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true});
export function validText(text){if(typeof text!=='string'||Array.from(text).length>200||Array.from(text).some(c=>{const n=c.codePointAt(0);return n>=0xd800&&n<=0xdfff;}))throw new Error('Use at most 200 Unicode code points, with no isolated surrogates.');}
const bytes=text=>Array.from(encoder.encode(text));
function replacePair(sequence,a,b,id){const result=[];for(let i=0;i<sequence.length;i++){if(sequence[i]===a&&sequence[i+1]===b){result.push(id);i++;}else result.push(sequence[i]);}return result;}
function piece(raw){try{return decoder.decode(new Uint8Array(raw)).replaceAll(' ','␠').replaceAll('\n','↵').replaceAll('\t','⇥').replaceAll('\r','␍');}catch{return 'hex '+raw.map(b=>b.toString(16).padStart(2,'0').toUpperCase()).join(' ');}}
export function trainBPE(budget=16){
 if(!Number.isInteger(budget)||budget<0||budget>24)throw new Error('Merge budget must be an integer from 0 to 24.');
 const vocabulary=Array.from({length:256},(_,i)=>[i]),merges=[];let sequences=data.corpus.map(bytes);
 for(let step=0;step<budget;step++){
  const counts=new Map();for(const s of sequences)for(let i=0;i<s.length-1;i++){const key=s[i]+','+s[i+1];counts.set(key,(counts.get(key)||0)+1);}
  const ranked=Array.from(counts,([key,count])=>({pair:key.split(',').map(Number),count})).sort((a,b)=>b.count-a.count||a.pair[0]-b.pair[0]||a.pair[1]-b.pair[1]);
  const best=ranked[0];if(!best||best.count<2)break;const [left,right]=best.pair,id=vocabulary.length;
  vocabulary.push([...vocabulary[left],...vocabulary[right]]);merges.push({rank:step+1,left,right,id,count:best.count,piece:piece(vocabulary[id])});sequences=sequences.map(s=>replacePair(s,left,right,id));
 }
 return {vocabulary,merges};
}
export function tokenize(text='this movie is fun.',budget=16){
 validText(text);const model=trainBPE(budget);let ids=bytes(text);for(const m of model.merges)ids=replacePair(ids,m.left,m.right,m.id);
 const decoded=decoder.decode(new Uint8Array(ids.flatMap(id=>model.vocabulary[id])));
 return {text,budget,codepoints:Array.from(text).length,byte_count:bytes(text).length,vocab_size:model.vocabulary.length,merges:model.merges,ids,tokens:ids.map(id=>({id,piece:piece(model.vocabulary[id]),bytes:model.vocabulary[id]})),decoded,roundtrip:decoded===text};
}
export function words(text){validText(text);return text.toLowerCase().match(/[a-z]+|[^\s]/gu)||[];}
export function fitBigram(){
 const rows=data.corpus.map(words),vocabulary=['<eos>','<unk>',...Array.from(new Set(rows.flat())).sort()];
 const counts=Object.fromEntries(['<bos>',...vocabulary].map(t=>[t,Array(vocabulary.length).fill(0)]));
 for(const row of rows){let previous='<bos>';for(const token of [...row,'<eos>']){counts[previous][vocabulary.indexOf(token)]++;previous=token;}}
 return {vocabulary,counts};
}
const model=fitBigram();
export function distribution(context='<bos>',alpha=1){
 if(![0,1].includes(alpha)||typeof context!=='string')throw new Error('Invalid probability configuration.');
 const key=Object.hasOwn(model.counts,context)?context:'<unk>',counts=model.counts[key],total=counts.reduce((a,b)=>a+b,0),denominator=total+alpha*model.vocabulary.length;
 return {context:key,total,denominator,rows:model.vocabulary.map((token,id)=>({id,token,count:counts[id],probability:denominator?(counts[id]+alpha)/denominator:0}))};
}
export function decoding(rows,temperature=1,topk=0){
 if(![.5,1,2].includes(temperature)||![0,3].includes(topk))throw new Error('Invalid decoding configuration.');
 const ranked=rows.filter(r=>r.probability>0).map(r=>({...r,logit:Math.log(r.probability)/temperature})).sort((a,b)=>b.logit-a.logit||a.id-b.id);
 const kept=topk?ranked.slice(0,topk):ranked;const max=kept[0]?.logit??0,total=kept.reduce((s,r)=>s+Math.exp(r.logit-max),0);
 return rows.map(r=>{const k=kept.find(x=>x.id===r.id);return {...r,sampling_probability:k?Math.exp(k.logit-max)/total:0};});
}
export function generate(prefix='this movie is',alpha=1,temperature=1,topk=0,method='sample',seed=42,limit=10){
 if(!['sample','greedy'].includes(method)||!Number.isInteger(seed)||seed<0||seed>4294967295||!Number.isInteger(limit)||limit<1||limit>20)throw new Error('Invalid generation configuration.');
 const input=words(prefix),mapped=input.map(t=>model.vocabulary.includes(t)?t:'<unk>'),steps=[],generated=[];let context=mapped.at(-1)||'<bos>',state=seed,stop='Token limit';
 for(let i=0;i<limit;i++){
  const d=distribution(context,alpha),rows=decoding(d.rows,temperature,topk);if(!rows.some(r=>r.sampling_probability>0)){stop='No observed continuation';break;}
  let selected,draw=null;
  if(method==='greedy')selected=[...rows].sort((a,b)=>b.sampling_probability-a.sampling_probability||a.id-b.id)[0];
  else{state=(Math.imul(1664525,state)+1013904223)>>>0;draw=state/4294967296;let cumulative=0;selected=rows.filter(r=>r.sampling_probability>0).at(-1);for(const r of rows){cumulative+=r.sampling_probability;if(draw<cumulative){selected=r;break;}}}
  if(!selected)throw new Error('No token selected.');
  steps.push({position:i+1,context,token:selected.token,base_probability:selected.probability,sampling_probability:selected.sampling_probability,draw});generated.push(selected.token);context=selected.token;if(context==='<eos>'){stop='End token';break;}
 }
 return {prefix,alpha,temperature,topk,method,seed,limit,input_tokens:input,mapped_tokens:mapped,generated_tokens:generated,steps,stop,text:[...mapped,...generated.filter(t=>t!=='<eos>')].join(' ').replaceAll(' .','.')};
}
export function score(text='this movie is fun .',alpha=1){
 const original=words(text),mapped=original.map(t=>model.vocabulary.includes(t)?t:'<unk>');let context='<bos>';
 const steps=[...mapped,'<eos>'].map((token,i)=>{const d=distribution(context,alpha),probability=d.rows.find(r=>r.token===token).probability,result={position:i+1,context,token,probability,nll:probability>0?-Math.log(probability):null};context=token;return result;});
 const zero_probabilities=steps.filter(s=>s.probability===0).length,mean_nll=zero_probabilities?null:steps.reduce((s,t)=>s+t.nll,0)/steps.length;
 return {text,alpha,original,mapped,unknowns:original.filter((_,i)=>mapped[i]==='<unk>'),steps,target_count:steps.length,zero_probabilities,mean_nll,perplexity:mean_nll===null?null:Math.exp(mean_nll)};
}
export function explore(prefix='this movie is',alpha=1,temperature=1,topk=0,method='sample',score_case='familiar'){
 if(!Object.hasOwn(data.scores,score_case))throw new Error('Unknown scoring case.');const input=words(prefix),context=input.at(-1)||'<bos>',d=distribution(context,alpha);
 return {prefix,alpha,temperature,topk,method,score_case,vocabulary:model.vocabulary,context:d.context,total:d.total,denominator:d.denominator,rows:decoding(d.rows,temperature,topk),generation:generate(prefix,alpha,temperature,topk,method),scoring:score(data.scores[score_case],alpha)};
}
