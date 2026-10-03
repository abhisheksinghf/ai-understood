import dataset from '../../public/downloads/chapter-21-training/data.json' with {type:'json'};
export {dataset};
export const WIDTH=8;
export const presets={
 baseline:{label:'Scaled + Adam',scale:true,init:'xavier',optimizer:'adam',rate:.03,l2:0},
 raw:{label:'Unscaled inputs',scale:false,init:'xavier',optimizer:'adam',rate:.03,l2:0},
 zero:{label:'All-zero initialization',scale:true,init:'zero',optimizer:'adam',rate:.03,l2:0},
 fast:{label:'Large Adam learning rate',scale:true,init:'xavier',optimizer:'adam',rate:1,l2:0},
 regularized:{label:'L2-regularized Adam',scale:true,init:'xavier',optimizer:'adam',rate:.03,l2:.02},
 sgd:{label:'Plain gradient descent',scale:true,init:'xavier',optimizer:'sgd',rate:.03,l2:0},
};
export function rng(seed){let state=seed;return ()=>{state=(1664525*state+1013904223)%4294967296;return state/4294967296;};}
export function initialize(mode='xavier'){
 if(mode==='zero')return Array(4*WIDTH+1).fill(0);
 if(mode!=='xavier')throw new Error('Unknown initialization.');
 const random=rng(42);let limit=Math.sqrt(6/(2+WIDTH));const theta=[];
 for(let j=0;j<WIDTH;j++)theta.push((2*random()-1)*limit,(2*random()-1)*limit,0);
 limit=Math.sqrt(6/(WIDTH+1));for(let j=0;j<WIDTH;j++)theta.push((2*random()-1)*limit);return [...theta,0];
}
export function validate(data){
 if(!data||typeof data!=='object')throw new Error('Expected a dataset object.');
 const seen=new Set();for(const split of ['train','validation']){
  if(!Array.isArray(data[split])||!data[split].length)throw new Error('Both train and validation must be nonempty lists.');
  for(const row of data[split]){
   if(!row||typeof row!=='object')throw new Error('Expected row objects.');
   if(typeof row.id!=='string'||!row.id||seen.has(row.id))throw new Error('Rows need unique nonempty IDs across splits.');seen.add(row.id);
   if(!Array.isArray(row.x)||row.x.length!==2||row.x.some(v=>!Number.isFinite(v)))throw new Error('Each row needs two finite numerical features.');
   if(row.y!==0&&row.y!==1)throw new Error('Labels must be integer 0 or 1.');
  }
 }
}
export function fitScaler(rows,enabled=true){
 const mean=[0,1].map(i=>rows.reduce((s,r)=>s+r.x[i],0)/rows.length);
 const std=[0,1].map(i=>Math.sqrt(rows.reduce((s,r)=>s+(r.x[i]-mean[i])**2,0)/rows.length)||1);
 return {mean:enabled?mean:[0,0],std:enabled?std:[1,1]};
}
export function transform(rows,scaler){return rows.map(r=>({...r,x:r.x.map((v,i)=>(v-scaler.mean[i])/scaler.std[i])}));}
export function forward(theta,x){
 const h=Array.from({length:WIDTH},(_,j)=>Math.tanh(theta[3*j]*x[0]+theta[3*j+1]*x[1]+theta[3*j+2]));
 const z=h.reduce((s,v,j)=>s+v*theta[3*WIDTH+j],theta.at(-1));
 const p=z>=0?1/(1+Math.exp(-z)):Math.exp(z)/(1+Math.exp(z));return {h,z,p};
}
export function weightIndex(i){return (i<3*WIDTH&&i%3!==2)||(i>=3*WIDTH&&i<4*WIDTH);}
export function evaluate(theta,rows,l2=0){
 let gradient=theta.map(()=>0),loss=0,correct=0,saturated=0;const predictions=[];
 for(const row of rows){const {x,y}=row,{h,z,p}=forward(theta,x);
  loss+=Math.max(z,0)-z*y+Math.log1p(Math.exp(-Math.abs(z)));correct+=Number(Number(p>=.5)===y);saturated+=h.filter(v=>Math.abs(v)>.99).length;predictions.push({id:row.id,y,p});const d=p-y;
  for(let j=0;j<WIDTH;j++){const dh=d*theta[3*WIDTH+j]*(1-h[j]**2);gradient[3*j]+=dh*x[0];gradient[3*j+1]+=dh*x[1];gradient[3*j+2]+=dh;gradient[3*WIDTH+j]+=d*h[j];}gradient[gradient.length-1]+=d;
 }
 loss/=rows.length;gradient=gradient.map(g=>g/rows.length);const penalty=l2/2*theta.reduce((s,v,i)=>s+(weightIndex(i)?v*v:0),0);
 gradient=gradient.map((g,i)=>g+(weightIndex(i)?l2*theta[i]:0));
 return {loss,objective:loss+penalty,penalty,accuracy:correct/rows.length,saturation:saturated/(rows.length*WIDTH),gradient,predictions};
}
export function optimizerStep(theta,gradient,state,config){
 if(config.optimizer==='sgd')return {theta:theta.map((t,i)=>t-config.rate*gradient[i]),state:{step:state.step+1,m:[...state.m],v:[...state.v]}};
 const step=state.step+1,m=state.m.map((v,i)=>.9*v+.1*gradient[i]),v=state.v.map((s,i)=>.999*s+.001*gradient[i]**2);
 const update=config.optimizer==='adam'?m.map((mi,i)=>config.rate*(mi/(1-.9**step))/(Math.sqrt(v[i]/(1-.999**step))+1e-8)):gradient.map(g=>config.rate*g);
 return {theta:theta.map((t,i)=>t-update[i]),state:{step,m,v}};
}
export function order(length,epoch){const ids=Array.from({length},(_,i)=>i),random=rng(1000+epoch);for(let i=length-1;i>0;i--){const j=Math.floor(random()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}return ids;}
export function run(preset='baseline',early_stop=false,batch_size=16,data=dataset,epochs=600){
 if(!Object.hasOwn(presets,preset)||typeof early_stop!=='boolean'||![4,16].includes(batch_size)||!Number.isInteger(epochs)||epochs<1||epochs>600)throw new Error('Choose a known preset, a boolean stop policy, batch 4 or 16, and 1–600 epochs.');
 validate(data);const config={...presets[preset]},scaler=fitScaler(data.train,config.scale),training=transform(data.train,scaler),validation=transform(data.validation,scaler);
 let theta=initialize(config.init),state={step:0,m:theta.map(()=>0),v:theta.map(()=>0)},best=null,stale=0,patience_loss=Infinity,stop_reason='Epoch budget reached';const history=[];
 for(let epoch=0;epoch<=epochs;epoch++){
  const tr=evaluate(theta,training,config.l2),va=evaluate(theta,validation);
  const record={epoch,updates:state.step,train_loss:tr.loss,validation_loss:va.loss,objective:tr.objective,train_accuracy:tr.accuracy,validation_accuracy:va.accuracy,gradient_norm:Math.sqrt(tr.gradient.reduce((s,g)=>s+g*g,0)),saturation:tr.saturation};history.push(record);
  if(best===null||va.loss<best.validation_loss)best={...record,theta:[...theta],optimizer:{step:state.step,m:[...state.m],v:[...state.v]}};
  if(va.loss<patience_loss-.0001){patience_loss=va.loss;stale=0;}else stale++;
  if(early_stop&&stale>=30){stop_reason='Validation patience reached (30 epochs)';break;}
  if(epoch===epochs)break;
  const ids=order(training.length,epoch+1);
  for(let start=0;start<ids.length;start+=batch_size){const rows=ids.slice(start,start+batch_size).map(i=>training[i]),gradient=evaluate(theta,rows,config.l2).gradient;({theta,state}=optimizerStep(theta,gradient,state,config));if(theta.some(v=>!Number.isFinite(v)))throw new Error('Non-finite parameters: inspect inputs, loss and learning rate.');}
 }
 const lastRecord=history.at(-1);
 if(!lastRecord||best===null)throw new Error('Training produced no checkpoint.');
 const last={...lastRecord,theta:[...theta],optimizer:state};
 return {preset,config,early_stop,batch_size,budget:epochs,stop_reason,scaler,train_count:training.length,validation_count:validation.length,best,last,history,best_predictions:evaluate(best.theta,validation).predictions,last_predictions:evaluate(theta,validation).predictions};
}
