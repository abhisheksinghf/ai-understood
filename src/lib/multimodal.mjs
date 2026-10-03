import data from '../../public/downloads/chapter-30-multimodal/data.json' with {type:'json'};
export {data};
export function cosine(a,b){
 if(!Array.isArray(a)||!Array.isArray(b)||a.length===0||a.length!==b.length||[...a,...b].some(v=>!Number.isFinite(v)))throw new Error('Invalid vectors.');
 const na=Math.hypot(...a),nb=Math.hypot(...b);if(!na||!nb)throw new Error('Zero vectors have no cosine direction.');
 return a.reduce((s,v,j)=>s+(v/na)*(b[j]/nb),0);
}
export function match(query='calm',space='aligned',temperature=.5,candidates='all'){
 const q=data.queries.find(q=>q.id===query);
 if(!q||!['aligned','mismatched'].includes(space)||![.1,.5,1].includes(temperature)||!Object.hasOwn(data.candidateSets,candidates))throw new Error('Invalid matching configuration.');
 const scores=data.posters.filter(p=>data.candidateSets[candidates].includes(p.id)).map(p=>{const vector=space==='aligned'?[...p.vector]:[p.vector[2],p.vector[0],p.vector[1]];return {id:p.id,title:p.title,vector,score:cosine(q.vector,vector)};});
 const peak=Math.max(...scores.map(r=>r.score/temperature)),weights=scores.map(r=>Math.exp(r.score/temperature-peak)),total=weights.reduce((s,v)=>s+v,0);
 const rows=scores.map((r,i)=>({...r,share:weights[i]/total})).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
 return {config:{query,space,temperature,candidates},queryText:q.text,queryVector:[...q.vector],rows,winner:rows[0].id};
}
export function patchCount(width,height,patch=16){
 if(![width,height,patch].every(v=>Number.isInteger(v)&&v>0)||width%patch||height%patch)throw new Error('Use positive integer dimensions divisible by the patch size.');
 return width/patch*(height/patch);
}
export function sampleVideo(interval=4,phase=0,resolution=224,alignAudio=true){
 if(![1,2,4,5].includes(interval)||![0,.25,.5,.75].includes(phase)||![224,448].includes(resolution)||typeof alignAudio!=='boolean')throw new Error('Invalid sampling configuration.');
 const {trailer}=data,frames=[];
 for(let time=phase*interval;time<trailer.duration;time+=interval){const scene=trailer.scenes.find(s=>time>=s.start&&time<s.end);frames.push({time,scene:scene.label,caption:scene.caption,event:time>=trailer.event.start&&time<trailer.event.end});}
 const hitTimes=frames.filter(f=>f.event).map(f=>f.time),audio=trailer.audio,offset=alignAudio?audio.sourceOffset:0,start=audio.localStart+offset,end=audio.localEnd+offset;
 return {config:{interval,phase,resolution,alignAudio},frames,hitTimes,observed:hitTimes.length>0,patchesPerFrame:patchCount(resolution,resolution),totalPatches:frames.length*patchCount(resolution,resolution),audio:{start,end,text:audio.text,correctlyMapped:alignAudio,overlapFrames:frames.filter(f=>f.time>=start&&f.time<end).map(f=>f.time)}};
}
