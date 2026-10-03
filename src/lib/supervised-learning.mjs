import dataset from '../../public/downloads/chapter-13-supervised-learning/movie_learning.json' with {type:'json'};
export {dataset};
export const strengths=[0,.1,1];
export const LOGISTIC_STEPS=2000,LEARNING_RATE=.3;
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
export function validateDataset(data=dataset){
  if(!exact(data,['version','rows'])||data.version!=='movie-supervised-v1'||!Array.isArray(data.rows)||data.rows.length>5000)throw new Error('Expected the versioned movie dataset, at most 5000 rows.');
  const ids=new Set(),viewers=new Map();
  /** @type {{train:typeof dataset.rows,validation:typeof dataset.rows,test:typeof dataset.rows}} */
  const splits={train:[],validation:[],test:[]};
  for(const r of data.rows){
    if(!exact(r,['event_id','viewer_id','split','history_like_fraction','rating','liked'])||!/^S[0-9]{2}$/.test(r.event_id)||!/^V[0-9]{2}$/.test(r.viewer_id)||!['train','validation','test'].includes(r.split)||ids.has(r.event_id))throw new Error('Invalid fields, IDs, split, or duplicate event.');
    if(!finite(r.history_like_fraction)||r.history_like_fraction<0||r.history_like_fraction>1||!finite(r.rating)||r.rating<1||r.rating>5||!finite(r.liked)||![0,1].includes(r.liked))throw new Error('History must be 0–1, rating 1–5, and liked 0 or 1.');
    if(viewers.has(r.viewer_id)&&viewers.get(r.viewer_id)!==r.split)throw new Error('A viewer cannot cross split boundaries.');
    ids.add(r.event_id);viewers.set(r.viewer_id,r.split);splits[r.split].push(r);
  }
  if(splits.train.length<2||!splits.validation.length||!splits.test.length||new Set(splits.train.map(r=>r.liked)).size!==2)throw new Error('Need training examples of both classes and nonempty held-out splits.');
  return splits;
}
export const feature=s=>2*s-1;
export function sigmoid(z){if(z>=0)return 1/(1+Math.exp(-z));const t=Math.exp(z);return t/(1+t);}
export const logisticLoss=(z,y)=>Math.max(z,0)-y*z+Math.log1p(Math.exp(-Math.abs(z)));
export function fitModel(rows,task='regression',strength=0){
  if(!['regression','classification'].includes(task)||!strengths.includes(strength)||rows.length<2)throw new Error('Choose a supported task, strength, and at least two training rows.');
  const xs=rows.map(r=>feature(r.history_like_fraction));
  if(task==='regression'){
    const ys=rows.map(r=>r.rating),mx=mean(xs),my=mean(ys),variance=mean(xs.map(x=>(x-mx)**2));
    if(variance===0&&strength===0)throw new Error('Constant feature: use a constant baseline or positive regularization.');
    const w=mean(xs.map((x,i)=>(x-mx)*(ys[i]-my)))/(variance+strength);
    return {task,strength,w,b:my-w*mx,solver:'closed_form',steps:0};
  }
  if(new Set(rows.map(r=>r.liked)).size!==2)throw new Error('Logistic training needs both classes in this workbook.');
  let w=0,b=0;
  for(let step=0;step<LOGISTIC_STEPS;step++){
    const errors=xs.map((x,i)=>sigmoid(w*x+b)-rows[i].liked);
    const dw=mean(errors.map((e,i)=>e*xs[i]))+strength*w,db=mean(errors);
    w-=LEARNING_RATE*dw;b-=LEARNING_RATE*db;
  }
  return {task,strength,w,b,solver:'batch_gradient_descent',steps:LOGISTIC_STEPS};
}
export function predict(model,history){const z=model.w*feature(history)+model.b;return model.task==='regression'?z:sigmoid(z);}
export const decide=(p,threshold)=>Number(p>=threshold);
export function metrics(rows,model,threshold=.5){
  const predictions=rows.map(r=>predict(model,r.history_like_fraction));
  if(model.task==='regression'){
    const errors=predictions.map((p,i)=>p-rows[i].rating),mse=mean(errors.map(e=>e*e));
    return {mse,rmse:Math.sqrt(mse),mae:mean(errors.map(Math.abs))};
  }
  let tp=0,fp=0,tn=0,fn=0;
  predictions.forEach((p,i)=>{const label=decide(p,threshold),y=rows[i].liked;if(label&&y)tp++;else if(label)fp++;else if(y)fn++;else tn++;});
  return {log_loss:mean(rows.map(r=>logisticLoss(model.w*feature(r.history_like_fraction)+model.b,r.liked))),accuracy:(tp+tn)/rows.length,tp,fp,tn,fn};
}
export function experiment(task='regression',strength=0,history=.75,threshold=.5,data=dataset,evaluateTest=false){
  if(!finite(history)||history<0||history>1||!finite(threshold)||threshold<0||threshold>1||typeof evaluateTest!=='boolean')throw new Error('History and threshold must be finite numbers in 0–1.');
  const splits=validateDataset(data),model=fitModel(splits.train,task,strength);
  const probability=mean(splits.train.map(r=>r.liked));
  const baseline={task,strength:0,w:0,b:task==='regression'?mean(splits.train.map(r=>r.rating)):Math.log(probability/(1-probability)),solver:'constant_training_target',steps:0};
  const reports=Object.fromEntries((evaluateTest?['train','validation','test']:['train','validation']).map(role=>[role,{model:metrics(splits[role],model,threshold),baseline:metrics(splits[role],baseline,threshold)}]));
  const prediction=predict(model,history);
  return {dataset_version:data.version,feature_transform:'x = 2 * history_like_fraction - 1',model,baseline,threshold:task==='classification'?threshold:null,query:{history_like_fraction:history,prediction,predicted_class:task==='classification'?decide(prediction,threshold):null},split_counts:Object.fromEntries(Object.entries(splits).map(([k,v])=>[k,v.length])),reports};
}
