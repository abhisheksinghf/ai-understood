import data from '../../public/downloads/chapter-22-architectures/data.json' with {type:'json'};
export {data};
const mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
function matrix(m){if(!Array.isArray(m)||!m.length||!Array.isArray(m[0])||!m[0].length||!m.every(row=>Array.isArray(row)&&row.length===m[0].length&&row.every(Number.isFinite)))throw new Error('Expected a nonempty rectangular finite matrix.');}
export function convolve(input,kernel,stride=1,padding=0){
 matrix(input);matrix(kernel);
 if(!Number.isInteger(stride)||stride<1||!Number.isInteger(padding)||padding<0)throw new Error('Invalid stride or padding.');
 const height=Math.floor((input.length+2*padding-kernel.length)/stride)+1,width=Math.floor((input[0].length+2*padding-kernel[0].length)/stride)+1;
 if(height<1||width<1)throw new Error('Kernel does not fit.');
 return Array.from({length:height},(_,i)=>Array.from({length:width},(_,j)=>kernel.reduce((s,row,a)=>s+row.reduce((v,k,b)=>v+k*(input[i*stride+a-padding]?.[j*stride+b-padding]??0),0),0)));
}
export function pool(input){matrix(input);const h=Math.floor(input.length/2),w=Math.floor(input[0].length/2);if(!h||!w)throw new Error('A 2 by 2 window must fit.');return Array.from({length:h},(_,i)=>Array.from({length:w},(_,j)=>Math.max(input[2*i][2*j],input[2*i+1][2*j],input[2*i][2*j+1],input[2*i+1][2*j+1])));}
export function cnn(poster='edge',filter='vertical',stride=1,padding=0){
 if(!Object.hasOwn(data.posters,poster)||!Object.hasOwn(data.kernels,filter)||![1,2].includes(stride)||![0,1].includes(padding))throw new Error('Invalid CNN configuration.');
 const input=data.posters[poster],kernel=data.kernels[filter],output=convolve(input,kernel,stride,padding),activation=output.map(row=>row.map(x=>Math.max(0,x)));
 return {poster,filter,stride,padding,input,kernel,output,activation,pooled:pool(activation),global_mean:mean(activation.flat()),parameters:10};
}
export function sequence(history='original',recurrent=.5,mask=true){
 if(!Object.hasOwn(data.histories,history)||![0,.5,1].includes(recurrent)||typeof mask!=='boolean')throw new Error('Invalid sequence configuration.');
 const inputs=data.histories[history];let h=0;
 const steps=[...inputs,0,0].map((x,i)=>{const previous=h,padding=i>=inputs.length;const candidate=Math.tanh(.8*x+recurrent*h);if(!(padding&&mask))h=candidate;return {step:i+1,x,padding,skipped:padding&&mask,previous,candidate,state:h};});
 return {history,recurrent,mask,inputs,mean:mean(inputs),steps,real_final:steps[inputs.length-1].state,final:h};
}
export function forward(theta,input=data.transfer.input,label=data.transfer.label){
 if(theta.length!==9||!theta.every(Number.isFinite)||input.length!==2||!input.every(Number.isFinite)||![0,1].includes(label))throw new Error('Invalid network values.');
 const features=[0,1].map(i=>Math.tanh(theta[3*i]*input[0]+theta[3*i+1]*input[1]+theta[3*i+2]));
 const logit=theta[6]*features[0]+theta[7]*features[1]+theta[8],probability=1/(1+Math.exp(-logit)),loss=Math.max(logit,0)-label*logit+Math.log1p(Math.exp(-Math.abs(logit)));
 const d=probability-label;const gradient=Array(9).fill(0);
 for(let i=0;i<2;i++){const delta=d*theta[6+i]*(1-features[i]**2);gradient[3*i]=delta*input[0];gradient[3*i+1]=delta*input[1];gradient[3*i+2]=delta;gradient[6+i]=d*features[i];}gradient[8]=d;
 return {features,logit,probability,loss,gradient};
}
export function transfer(mode='frozen'){
 if(!['frozen','finetune'].includes(mode))throw new Error('Invalid transfer mode.');
 const {theta,input,label,rate}=data.transfer;const before=forward(theta,input,label),trainable=theta.map((_,i)=>mode==='finetune'||i>=6),after_theta=theta.map((p,i)=>p-(trainable[i]?rate*before.gradient[i]:0)),after=forward(after_theta,input,label);
 return {mode,input,label,rate,before_theta:[...theta],after_theta,trainable,trainable_count:trainable.filter(Boolean).length,total_count:9,before,after,backbone_change:Math.max(...after_theta.slice(0,6).map((p,i)=>Math.abs(p-theta[i])))};
}
