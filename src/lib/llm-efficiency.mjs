import data from '../../public/downloads/chapter-26-efficiency/data.json' with {type:'json'};
export {data};
const GIB=2**30;
export function memory(weightBits=16,kvHeads=8,cacheBits=16,batch=1,tokens=4096,budget=16){
 for(const [value,allowed] of [[weightBits,[4,8,16]],[kvHeads,[1,8,32]],[cacheBits,[8,16]],[batch,[1,4,8]],[tokens,[1024,4096,8192]],[budget,[8,16,24]]])if(!allowed.includes(value))throw new Error('Unsupported memory configuration.');
 const weightsBytes=data.parameters*weightBits/8,cachePerToken=2*data.layers*kvHeads*data.head_dimension*cacheBits/8,cacheBytes=batch*tokens*cachePerToken,reserveBytes=data.reserve_gib*GIB,budgetBytes=budget*GIB,totalBytes=weightsBytes+cacheBytes+reserveBytes;
 return {config:{weightBits,kvHeads,cacheBits,batch,tokens,budget},parameters:data.parameters,layers:data.layers,queryHeads:data.query_heads,headDimension:data.head_dimension,weightsBytes,cachePerToken,cacheBytes,reserveBytes,totalBytes,budgetBytes,headroomBytes:budgetBytes-totalBytes,withinEstimate:totalBytes<=budgetBytes,gib:{weights:weightsBytes/GIB,cache:cacheBytes/GIB,reserve:data.reserve_gib,total:totalBytes/GIB,headroom:(budgetBytes-totalBytes)/GIB},maxSequences:Math.max(0,Math.floor((budgetBytes-weightsBytes-reserveBytes)/(tokens*cachePerToken)))};
}
/** @param {number} x */
export function roundAway(x){return Math.sign(x)*Math.floor(Math.abs(x)+.5);}
/** Symmetric signed quantization; scale metadata is modeled, not binary-packed.
 * @param {number[]} weights @param {number} bits @param {number} groupSize */
export function quantize(weights,bits=4,groupSize=weights.length){
 if(![4,8].includes(bits)||!Number.isInteger(groupSize)||groupSize<1||!weights.length||weights.some(w=>!Number.isFinite(w)))throw new Error('Invalid quantization inputs.');
 const qmax=2**(bits-1)-1,rows=[],scales=[];
 for(let start=0;start<weights.length;start+=groupSize){const chunk=weights.slice(start,start+groupSize),peak=Math.max(...chunk.map(Math.abs)),scale=peak===0?1:peak/qmax;scales.push(scale);
  for(let j=0;j<chunk.length;j++){const original=chunk[j],code=Math.max(-qmax,Math.min(qmax,roundAway(original/scale))),restored=code*scale;rows.push({index:start+j,group:scales.length,original,scale,code,restored,error:restored-original});}
 }
 const payloadBytes=Math.ceil(weights.length*bits/8),scaleBytes=scales.length*4;
 return {bits,groupSize,qmax,scales,rows,mae:rows.reduce((s,r)=>s+Math.abs(r.error),0)/weights.length,maxError:Math.max(...rows.map(r=>Math.abs(r.error))),payloadBytes,scaleBytes,totalBytes:payloadBytes+scaleBytes,fp32Bytes:weights.length*4};
}
export function compression(preset='balanced',bits=4,grouping='tensor'){
 if(!Object.hasOwn(data.weights,preset)||!['tensor','pairs'].includes(grouping))throw new Error('Invalid compression configuration.');
 const weights=data.weights[preset],q=quantize(weights,bits,grouping==='tensor'?weights.length:2),features=data.features,originalScore=weights.reduce((s,w,i)=>s+w*features[i],0),restoredScore=q.rows.reduce((s,r,i)=>s+r.restored*features[i],0);
 return {preset,grouping,...q,features,originalScore,restoredScore,scoreChange:restoredScore-originalScore};
}
