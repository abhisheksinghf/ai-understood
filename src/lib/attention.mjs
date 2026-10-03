import data from '../../public/downloads/chapter-24-attention/data.json' with {type:'json'};
export {data};
/** @param {number[]} a @param {number[]} b */
export function dot(a,b){return a.reduce((sum,x,i)=>sum+x*b[i],0);}
/** @param {number[]} row @param {number[][]} matrix */
export function project(row,matrix){return matrix[0].map((_,j)=>row.reduce((sum,x,i)=>sum+x*matrix[i][j],0));}
export function position(index,width=4){return Array.from({length:width},(_,i)=>{const angle=index/10000**(2*Math.floor(i/2)/width);return i%2===0?Math.sin(angle):Math.cos(angle);});}
/** @param {(number|null)[]} scores */
export function softmax(scores){
 const allowed=scores.filter(x=>x!==null);if(!allowed.length)throw new Error('At least one key must be visible.');
 const max=Math.max(...allowed),exps=scores.map(x=>x===null?0:Math.exp(x-max)),sum=exps.reduce((a,b)=>a+b,0);return exps.map(x=>x/sum);
}
/** @param {number[][]} inputs @param {{Wq:number[][],Wk:number[][],Wv:number[][]}} head */
export function attend(inputs,head,causal=true){
 const Q=inputs.map(row=>project(row,head.Wq)),K=inputs.map(row=>project(row,head.Wk)),V=inputs.map(row=>project(row,head.Wv));
 const raw=Q.map(q=>K.map(k=>dot(q,k))),scaled=raw.map(row=>row.map(x=>x/Math.sqrt(Q[0].length))),masked=scaled.map((row,i)=>row.map((x,j)=>causal&&j>i?null:x)),weights=masked.map(softmax),outputs=weights.map(row=>V[0].map((_,d)=>row.reduce((sum,w,j)=>sum+w*V[j][d],0)));
 return {Q,K,V,raw,scaled,masked,weights,outputs};
}
export function explore(ending='fun',positions='none',causal=true){
 if(!['fun','slow'].includes(ending)||!['none','sinusoidal'].includes(positions)||typeof causal!=='boolean')throw new Error('Use ending fun/slow, positions none/sinusoidal, and a boolean causal mask.');
 const tokens=[...data.tokens.slice(0,3),ending],embeddings=tokens.map(t=>[...data.embeddings[t]]),positional=tokens.map((_,i)=>positions==='sinusoidal'?position(i):[0,0,0,0]),inputs=embeddings.map((row,i)=>row.map((x,d)=>x+positional[i][d]));
 const heads=data.heads.map(h=>({name:h.name,...attend(inputs,h,causal)})),concatenated=tokens.map((_,i)=>heads.flatMap(h=>h.outputs[i])),projected=concatenated.map(row=>project(row,data.Wo)),residual=inputs.map((row,i)=>row.map((x,d)=>x+projected[i][d]));
 return {ending,positions,causal,tokens,embeddings,positional,inputs,heads,concatenated,projected,residual,allowed_pairs:causal?10:16};
}
