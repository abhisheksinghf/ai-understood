import dataset from '../../public/downloads/chapter-14-unsupervised-learning/movie_features.json' with {type:'json'};
export {dataset};
export const MAX_STEPS=50;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
export const distance2=(a,b)=>(a[0]-b[0])**2+(a[1]-b[1])**2;
export function validateDataset(data=dataset){
  if(!exact(data,['version','movies'])||data.version!=='movie-structure-v1'||!Array.isArray(data.movies)||data.movies.length<3||data.movies.length>1000)throw new Error('Expected 3–1000 movies in the versioned dataset.');
  const ids=new Set();
  for(const m of data.movies){if(!exact(m,['id','title','action','humor'])||typeof m.id!=='string'||!/^M[0-9]{3}$/.test(m.id)||ids.has(m.id)||typeof m.title!=='string'||!m.title.trim()||m.title.length>100||!finite(m.action)||!finite(m.humor)||m.action<0||m.action>10||m.humor<0||m.humor>10)throw new Error('Movies need unique IDs, titles, and finite 0–10 feature scores.');ids.add(m.id);}
  return data.movies;
}
export function nearest(points,centers){return points.map(p=>{let best=0;for(let j=1;j<centers.length;j++)if(distance2(p,centers[j])<distance2(p,centers[best]))best=j;return best;});}
function snapshot(points,centers,step,converged){const assignments=nearest(points,centers);return {step,centers,assignments,inertia:points.reduce((sum,p,i)=>sum+distance2(p,centers[assignments[i]]),0),converged,clusters_found:new Set(assignments).size};}
export function initialState(points,k=3,start='spread'){
  if(![2,3].includes(k)||points.length<k||!['spread','first'].includes(start))throw new Error('Choose k=2 or 3 and a supported start.');
  const indices=start==='first'?Array.from({length:k},(_,i)=>i):(k===2?[0,points.length-1]:[0,Math.floor(points.length/2),points.length-1]);
  return snapshot(points,indices.map(i=>[...points[i]]),0,false);
}
export function nextState(points,state){
  if(state.converged||state.step>=MAX_STEPS)return state;
  const centers=state.centers.map((old,j)=>{const members=points.filter((_,i)=>state.assignments[i]===j);return members.length?[members.reduce((s,p)=>s+p[0],0)/members.length,members.reduce((s,p)=>s+p[1],0)/members.length]:[...old];});
  const next=snapshot(points,centers,state.step+1,false);
  next.converged=next.assignments.every((j,i)=>j===state.assignments[i]);
  return next;
}
export function clusterTrace(points,k=3,start='spread',steps=MAX_STEPS){
  if(!Number.isInteger(steps)||steps<0||steps>MAX_STEPS)throw new Error('Steps must be an integer from 0 to 50.');
  const trace=[initialState(points,k,start)];
  while(trace.length<=steps&&!trace.at(-1).converged)trace.push(nextState(points,trace.at(-1)));
  return trace;
}
export function fitPca(points){
  if(points.length<2)throw new Error('PCA needs at least two points.');
  const n=points.length,center=[points.reduce((s,p)=>s+p[0],0)/n,points.reduce((s,p)=>s+p[1],0)/n];
  const centered=points.map(p=>[p[0]-center[0],p[1]-center[1]]);
  const a=centered.reduce((s,p)=>s+p[0]**2,0)/n,b=centered.reduce((s,p)=>s+p[0]*p[1],0)/n,c=centered.reduce((s,p)=>s+p[1]**2,0)/n;
  if(a+c<=1e-14)throw new Error('No varying feature: PCA variance ratio is undefined.');
  const gap=Math.hypot(a-c,2*b),angle=gap<=1e-14?0:.5*Math.atan2(2*b,a-c);
  const axis=[Math.cos(angle),Math.sin(angle)];
  const eigenvalues=[(a+c+gap)/2,Math.max(0,(a+c-gap)/2)];
  const scores=centered.map(p=>p[0]*axis[0]+p[1]*axis[1]);
  const reconstructed=scores.map(z=>[center[0]+z*axis[0],center[1]+z*axis[1]]);
  const residuals=points.map((p,i)=>distance2(p,reconstructed[i]));
  return {center,axis,eigenvalues,explained_ratio:eigenvalues[0]/(a+c),scores,reconstructed,residuals,mean_squared_residual:residuals.reduce((s,x)=>s+x,0)/n};
}
export function experiment(mode='clusters',k=3,start='spread',humorWeight=1,steps=MAX_STEPS,data=dataset){
  if(!['clusters','pca'].includes(mode)||![1,3].includes(humorWeight))throw new Error('Choose clusters/PCA and humor weight 1 or 3.');
  const movies=validateDataset(data),raw=movies.map(m=>[m.action,m.humor]);
  if(mode==='pca')return {dataset_version:data.version,mode,feature_order:['action','humor'],fit_scope:'all nine demo movies (or the entire supplied snapshot)',model:fitPca(raw),movies};
  const points=raw.map(p=>[p[0],p[1]*humorWeight]),trace=clusterTrace(points,k,start,steps);
  return {dataset_version:data.version,mode,feature_order:['action','humor'],configuration:{k,start,humor_weight:humorWeight},fit_scope:'entire supplied snapshot; exploratory fit',state:trace.at(-1),trace,movies};
}
