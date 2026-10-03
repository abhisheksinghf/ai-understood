import data from '../../public/downloads/chapter-25-lifecycle/data.json' with {type:'json'};
export {data};
const V=data.vocabulary.length;
/** @param {number[]} logits */
export function softmax(logits){const m=Math.max(...logits),e=logits.map(x=>Math.exp(x-m)),s=e.reduce((a,b)=>a+b,0);return e.map(x=>x/s);}
/** @param {string[]} tokens @param {number} start */
function rows(tokens,start){const sequence=['<bos>','<bos>',...tokens,'<eos>'];return sequence.slice(2).map((target,i)=>({context:sequence.slice(i,i+2).join(' '),target,id:data.vocabulary.indexOf(target),selected:i>=start}));}
export function examples(stage='pretrain',mask='reply'){
 if(!['pretrain','sft'].includes(stage)||!['reply','all'].includes(mask))throw new Error('Invalid dataset or loss mask.');
 return stage==='pretrain'?data.pretraining.map(s=>rows(s.split(' '),0)):data.demonstrations.map(d=>rows(['<user>',d.genre,'<assistant>',...d.reply.split(' ')],mask==='reply'?3:0));
}
/** @returns {Record<string,number[]>} */
export function initial(){return Object.fromEntries([...new Set([...examples(),...examples('sft')].flat().map(r=>r.context))].sort().map(k=>[k,Array(V).fill(0)]));}
/** @param {Record<string,number[]>} weights @param {string} context @param {number} temperature */
export function distribution(weights,context,temperature=1){return softmax((weights[context]||Array(V).fill(0)).map(x=>x/temperature));}
/** @param {Record<string,number[]>} weights @param {ReturnType<typeof examples>} dataset */
export function lossGradient(weights,dataset){
 const selected=dataset.flat().filter(r=>r.selected),gradient=Object.fromEntries(Object.keys(weights).map(k=>[k,Array(V).fill(0)]));let total=0;
 for(const row of selected){const p=distribution(weights,row.context);total-=Math.log(p[row.id]);for(let j=0;j<V;j++)gradient[row.context][j]+=(p[j]-(j===row.id?1:0))/selected.length;}
 return {loss:total/selected.length,targets:selected.length,gradient};
}
/** @param {Record<string,number[]>} starting @param {ReturnType<typeof examples>} dataset @param {number} steps */
function optimize(starting,dataset,steps){const weights=structuredClone(starting),history=[];for(let i=0;i<=steps;i++){const state=lossGradient(weights,dataset);history.push({step:i,loss:state.loss});if(i<steps)for(const key of Object.keys(weights))for(let j=0;j<V;j++)weights[key][j]-=data.learning_rate*state.gradient[key][j];}return {weights,history};}
export function train(mask='reply',steps=80){
 if(!['reply','all'].includes(mask)||![0,20,80].includes(steps))throw new Error('Use mask reply/all and 0, 20, or 80 SFT steps.');
 const pre=examples(),sft=examples('sft',mask),reply=examples('sft','reply'),start=initial(),base=optimize(start,pre,data.pretrain_steps),adapted=optimize(base.weights,sft,steps),checkpoints={initial:start,pretrained:base.weights,adapted:adapted.weights};
 const stages=Object.entries(checkpoints).map(([name,w])=>({name,pretrain_loss:lossGradient(w,pre).loss,reply_loss:lossGradient(w,reply).loss}));
 const demonstration=sft[0].map(r=>({...r,before:distribution(base.weights,r.context)[r.id],after:distribution(adapted.weights,r.context)[r.id]}));
 return {mask,steps,vocabulary:data.vocabulary,pretrain_steps:data.pretrain_steps,learning_rate:data.learning_rate,pretrain_targets:pre.flat().length,reply_targets:reply.flat().filter(r=>r.selected).length,sft_targets:sft.flat().filter(r=>r.selected).length,stages,demonstration,history:{pretrain:base.history,sft:adapted.history},checkpoints};
}
/** @param {Record<string,number[]>} weights */
export function generate(weights,prompt='comedy',method='greedy',temperature=1,limit=8){
 if(!Object.hasOwn(data.prompts,prompt)||!['greedy','sample'].includes(method)||![.75,1,1.5].includes(temperature)||![1,4,8].includes(limit))throw new Error('Invalid generation configuration.');
 const prefix=[...data.prompts[prompt]],sequence=[...prefix],trace=[];let state=data.seed,stop='Token limit';
 for(let i=0;i<limit;i++){const context=sequence.slice(-2).join(' '),base=distribution(weights,context),p=distribution(weights,context,temperature);let chosen=0,draw=null;
  if(method==='greedy'){for(let j=1;j<V;j++)if(p[j]>p[chosen])chosen=j;}else{state=(Math.imul(1664525,state)+1013904223)>>>0;draw=state/4294967296;let cumulative=0;chosen=V-1;for(let j=0;j<V;j++){cumulative+=p[j];if(draw<cumulative){chosen=j;break;}}}
  const token=data.vocabulary[chosen];trace.push({step:i+1,context,known_context:Object.hasOwn(weights,context),token,id:chosen,draw,base,probabilities:p});sequence.push(token);if(token==='<eos>'){stop='End token';break;}
 }
 const tokens=trace.map(r=>r.token);return {prompt,method,temperature,limit,seed:data.seed,prefix,tokens,text:tokens.filter(t=>t!=='<eos>').join(' ').replaceAll(' .','.'),stop,trace};
}
