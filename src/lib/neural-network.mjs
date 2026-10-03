// Original four-row teaching problem. Every row is used for training.
export const movies = [
  {id:'N1',title:'Moonlight Trail',x:[1,0],y:1},
  {id:'N2',title:'Letters at Dawn',x:[0,1],y:1},
  {id:'N3',title:'Hearts on the Run',x:[1,1],y:0},
  {id:'N4',title:'Quiet Notebook',x:[0,0],y:0},
];
export function initial(architecture='hidden') {
  if(architecture==='linear')return [0.3,-0.2,0.1];
  if(architecture==='hidden')return [0.6,-0.4,0.1,-0.3,0.8,-0.2,0.7,0.5,0.05,0.4,-0.5,0.3,-0.1];
  throw new Error('Architecture must be linear or hidden.');
}
export function sigmoid(z){return z>=0?1/(1+Math.exp(-z)):Math.exp(z)/(1+Math.exp(z));}
export function logLoss(z,y){return Math.max(z,0)-z*y+Math.log1p(Math.exp(-Math.abs(z)));}
export function forward(theta,x){
  if(![3,13].includes(theta.length)||theta.some(v=>!Number.isFinite(v)))throw new Error('Expected 3 or 13 finite parameters.');
  if(x.length!==2||x.some(v=>!Number.isFinite(v)))throw new Error('Expected two finite input values.');
  const a=theta.length===3?[]:[0,1,2].map(j=>theta[3*j]*x[0]+theta[3*j+1]*x[1]+theta[3*j+2]);
  const h=a.map(Math.tanh);
  const z=theta.length===3?theta[0]*x[0]+theta[1]*x[1]+theta[2]:h.reduce((s,v,j)=>s+v*theta[9+j],theta[12]);
  return {a,h,z,p:sigmoid(z)};
}
export function sampleGradient(theta,x,y){
  if(y!==0&&y!==1)throw new Error('Label must be 0 or 1.');
  const f=forward(theta,x),d=f.p-y,g=theta.map(()=>0);
  if(theta.length===3){g[0]=d*x[0];g[1]=d*x[1];g[2]=d;}
  else {for(let j=0;j<3;j++){const dh=d*theta[9+j]*(1-f.h[j]**2);g[3*j]=dh*x[0];g[3*j+1]=dh*x[1];g[3*j+2]=dh;g[9+j]=d*f.h[j];}g[12]=d;}
  return {loss:logLoss(f.z,y),gradient:g,...f};
}
export function batch(theta){
  const rows=movies.map(m=>({...m,...sampleGradient(theta,m.x,m.y)}));
  return {loss:rows.reduce((s,r)=>s+r.loss,0)/rows.length,
    accuracy:rows.filter(r=>Number(r.p>=0.5)===r.y).length/rows.length,
    gradient:theta.map((_,i)=>rows.reduce((s,r)=>s+r.gradient[i],0)/rows.length),
    rows:rows.map(({gradient,...row})=>({...row,predicted:Number(row.p>=0.5)}))};
}
export function update(theta,gradient,rate){
  if(!Number.isFinite(rate)||rate<=0||rate>2)throw new Error('Learning rate must be greater than 0 and at most 2.');
  if(theta.length!==gradient.length||gradient.some(v=>!Number.isFinite(v)))throw new Error('Invalid gradient.');
  return theta.map((v,i)=>v-rate*gradient[i]);
}
export function train(architecture='hidden',steps=0,rate=0.5){
  if(!Number.isInteger(steps)||steps<0||steps>2000)throw new Error('Steps must be an integer from 0 to 2000.');
  let theta=initial(architecture);update(theta,theta.map(()=>0),rate);
  const history=[];
  for(let i=0;i<=steps;i++){
    const b=batch(theta);
    if(i%20===0||i===steps)history.push({step:i,loss:b.loss});
    if(i===steps)return {architecture,steps,rate,parameter_count:theta.length,theta,...b,history};
    theta=update(theta,b.gradient,rate);
  }
}
