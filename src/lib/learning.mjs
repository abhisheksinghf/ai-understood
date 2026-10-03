// Original, deliberately small dataset. x = floor area in 1,000 sq ft; y = sale price in units of 10 lakh rupees.
export const trainingRows=Object.freeze([{x:1,y:3},{x:2,y:5},{x:3,y:7}].map(row=>Object.freeze(row)));
export const validationRows=Object.freeze([{x:1.5,y:4.2},{x:2.5,y:5.8}].map(row=>Object.freeze(row)));
export const INITIAL_WEIGHT=1;
export const MAX_STEPS=20;
export const MAX_DEMO_LOSS=100;
export const learningRates=[0.02,0.1,0.25];

/** @param {number} weight @param {number} x */
export function predict(weight,x){return weight*x+1;}
/** @param {number} weight @param {readonly {x:number,y:number}[]} rows */
export function meanSquaredError(weight,rows){
  return rows.reduce((sum,row)=>sum+(predict(weight,row.x)-row.y)**2,0)/rows.length;
}
/** Full-batch gradient for MSE; only the weight is fitted.
 * @param {number} weight */
export function trainingGradient(weight){
  return 2*trainingRows.reduce((sum,row)=>sum+row.x*(predict(weight,row.x)-row.y),0)/trainingRows.length;
}
export function initialLearningState(){return {weight:INITIAL_WEIGHT,steps:0,loss:meanSquaredError(INITIAL_WEIGHT,trainingRows),stopped:false};}
/** @param {{weight:number,steps:number,loss:number,stopped:boolean}} state @param {number} rate */
export function trainOneStep(state,rate){
  if(!learningRates.includes(rate))throw new RangeError('Choose a demonstrated learning rate');
  if(state.stopped||state.steps>=MAX_STEPS)return state;
  const weight=state.weight-rate*trainingGradient(state.weight);
  const loss=meanSquaredError(weight,trainingRows);
  return {weight,steps:state.steps+1,loss,stopped:loss>MAX_DEMO_LOSS};
}
