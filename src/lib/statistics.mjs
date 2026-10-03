/** Explicit calculations for Chapter 7's synthetic examples. */
export function summarize(values){
  if(!Array.isArray(values)||values.length<2||!values.every(v=>typeof v==='number'&&Number.isFinite(v)))throw new Error('Provide at least two finite observations.');
  const ordered=[...values].sort((a,b)=>a-b),n=values.length;
  const mean=values.reduce((a,b)=>a+b,0)/n;
  const median=n%2?ordered[(n-1)/2]:(ordered[n/2-1]+ordered[n/2])/2;
  const sampleVariance=values.reduce((sum,value)=>sum+(value-mean)**2,0)/(n-1);
  return {n,mean,median,sampleVariance,sampleSD:Math.sqrt(sampleVariance)};
}
export function alertScenario({baseRate=.01,recall=.9,falsePositiveRate=.05,total=10000}={}){
  if(![baseRate,recall,falsePositiveRate].every(p=>Number.isFinite(p)&&p>=0&&p<=1))throw new Error('Probabilities must be between zero and one.');
  if(!Number.isInteger(total)||total<=0)throw new Error('Total must be a positive integer.');
  const spamCount=total*baseRate,legitimate=total-spamCount;
  const truePositive=spamCount*recall,falseNegative=spamCount-truePositive;
  const falsePositive=legitimate*falsePositiveRate,trueNegative=legitimate-falsePositive;
  const alerts=truePositive+falsePositive;
  return {total,spamCount,legitimate,truePositive,falseNegative,falsePositive,trueNegative,alerts,precision:alerts===0?null:truePositive/alerts};
}
export function knownSigmaInterval(mean,sigma,n){
  if(!Number.isFinite(mean)||!Number.isFinite(sigma)||sigma<=0||!Number.isInteger(n)||n<1)throw new Error('Use a finite mean, positive known SD, and positive integer sample size.');
  const standardError=sigma/Math.sqrt(n),margin=1.96*standardError;
  return {standardError,margin,low:mean-margin,high:mean+margin};
}
