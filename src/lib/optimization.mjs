/** Original Chapter 8 examples. All quantities in the optimizer are dimensionless. */
export const descentRates=[0.1,0.5,1,1.5,2,2.2];
export const MAX_DESCENT_STEPS=12;
export function bowlLoss(w){return 0.5*(w-3)**2;}
export function bowlGradient(w){return w-3;}
export function descentTrace(start,rate,steps){
  if(!Number.isFinite(start)||start < -2||start > 6||!descentRates.includes(rate)||!Number.isInteger(steps)||steps<0||steps>MAX_DESCENT_STEPS)throw new RangeError('Choose a displayed start, rate, and 0–12 updates.');
  let w=start;
  const result=[{step:0,w,loss:bowlLoss(w),gradient:bowlGradient(w)}];
  for(let step=1;step<=steps;step++){w-=rate*bowlGradient(w);result.push({step,w,loss:bowlLoss(w),gradient:bowlGradient(w)});}
  return result;
}
function distribution(values){
  if(!Array.isArray(values)||!values.length||!values.every(p=>Number.isFinite(p)&&p>=0&&p<=1)||Math.abs(values.reduce((a,b)=>a+b,0)-1)>1e-10)throw new RangeError('Probabilities must be finite, nonnegative, and sum to one.');
}
export function entropy(probabilities){distribution(probabilities);return -probabilities.reduce((sum,p)=>sum+(p===0?0:p*Math.log2(p)),0);}
export function crossEntropy(p,q){
  distribution(p);distribution(q);if(p.length!==q.length)throw new RangeError('Use the same ordered categories.');
  return -p.reduce((sum,probability,i)=>sum+(probability===0?0:probability*Math.log2(q[i])),0);
}
export function klDivergence(p,q){return crossEntropy(p,q)-entropy(p);}
