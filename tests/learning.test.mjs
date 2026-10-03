import test from 'node:test';
import assert from 'node:assert/strict';
import {trainingRows,validationRows,predict,meanSquaredError,trainingGradient,initialLearningState,trainOneStep,MAX_STEPS} from '../src/lib/learning.mjs';
const near=(actual,expected,tolerance=1e-9)=>assert.ok(Math.abs(actual-expected)<tolerance,actual+' != '+expected);

test('hand-calculated chapter examples match predictions, losses, and the first update',()=>{
  assert.deepEqual(trainingRows.map(r=>predict(1,r.x)),[2,3,4]);
  near(meanSquaredError(1,trainingRows),14/3);
  near(meanSquaredError(2,trainingRows),0);
  near(meanSquaredError(2,validationRows),.04);
  near(trainingGradient(1),-28/3);
  const next=trainOneStep(initialLearningState(),.1);
  near(next.weight,29/15);
  near(next.loss,14/675);
});
test('training follows the gradient of the declared objective',()=>{
  const epsilon=1e-5;
  for(const weight of [-1,.5,2,3]){
    const numeric=(meanSquaredError(weight+epsilon,trainingRows)-meanSquaredError(weight-epsilon,trainingRows))/(2*epsilon);
    near(trainingGradient(weight),numeric,1e-6);
  }
});
test('a suitable rate converges; the large rate overshoots and reaches the demo stop',()=>{
  let steady=initialLearningState();
  for(let i=0;i<MAX_STEPS;i++){
    const next=trainOneStep(steady,.1);assert.ok(next.loss<=steady.loss);steady=next;
  }
  near(steady.weight,2);
  assert.equal(trainOneStep(steady,.1),steady,'The step limit preserves the state');
  let large=trainOneStep(initialLearningState(),.25);
  near(large.weight,10/3);assert.ok(large.loss>initialLearningState().loss);
  while(!large.stopped&&large.steps<MAX_STEPS)large=trainOneStep(large,.25);
  assert.equal(large.stopped,true);
  assert.ok(Number.isFinite(large.loss));
  assert.equal(trainOneStep(large,.25),large,'A stopped demo cannot continue');
});
test('inference and validation do not update the fitted state',()=>{
  const state=trainOneStep(initialLearningState(),.1);const before={...state};
  predict(state.weight,2.5);meanSquaredError(state.weight,validationRows);
  assert.deepEqual(state,before);
  assert.throws(()=>trainOneStep(state,-1),RangeError);
});
