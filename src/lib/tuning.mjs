import data from '../../public/downloads/chapter-28-tuning/data.json' with {type:'json'};
export {data};
export const sigmoid=x=>1/(1+Math.exp(-x));
const softplus=x=>Math.max(0,x)+Math.log1p(Math.exp(-Math.abs(x)));
export function lora(rank=1,alpha=2,stage='adapted'){
 if(![1,2].includes(rank)||![1,2,4].includes(alpha)||!['initial','adapted'].includes(stage))throw new Error('Invalid LoRA configuration.');
 const A=data.A.slice(0,rank).map(r=>[...r]),B=data.B.map(r=>r.slice(0,rank).map(v=>stage==='initial'?0:v)),scale=alpha/rank;
 const delta=B.map(row=>data.input.map((_,j)=>scale*row.reduce((s,b,k)=>s+b*A[k][j],0)));
 const baseOutput=data.base.map(row=>row.reduce((s,w,j)=>s+w*data.input[j],0));
 const update=delta.map(row=>row.reduce((s,w,j)=>s+w*data.input[j],0)),output=baseOutput.map((v,i)=>v+update[i]);
 return {rank,alpha,stage,scale,A,B,delta,input:[...data.input],baseOutput,update,output,baseParameters:16,trainableParameters:8*rank};
}
/** Toy DPO state for a normalized policy over exactly two complete replies. */
export function preferenceState(theta,referenceTheta,beta,sign){
 const pA=sigmoid(theta),pRef=sigmoid(referenceTheta),margin=sign*(theta-referenceTheta),z=beta*margin;
 const loss=softplus(-z),gradient=-beta*sign*sigmoid(-z),pairFit=sigmoid(z);
 const kl=pA*Math.log(pA/pRef)+(1-pA)*Math.log((1-pA)/(1-pRef));
 return {theta,pA,pB:1-pA,margin,z,loss,gradient,pairFit,kl:Math.max(0,kl)};
}
export function preference(reference=0.5,beta=0.5,rate=0.5,steps=10,chosen='A'){
 if(![0.2,0.5,0.8].includes(reference)||![0.1,0.5,1].includes(beta)||![0.1,0.5,1].includes(rate)||!Number.isInteger(steps)||steps<0||steps>40||!['A','B'].includes(chosen))throw new Error('Invalid preference configuration.');
 const referenceTheta=Math.log(reference/(1-reference)),sign=chosen==='A'?1:-1,history=[];
 let theta=referenceTheta;
 for(let step=0;step<=steps;step++){const state=preferenceState(theta,referenceTheta,beta,sign);history.push({step,...state});if(step<steps)theta-=rate*state.gradient;}
 return {config:{reference,beta,rate,steps,chosen},referenceTheta,initial:history[0],final:history.at(-1),history};
}
