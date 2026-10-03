import data from '../../public/downloads/chapter-38-reinforcement/data.json' with {type:'json'};
export const defaults={objective:'satisfaction',epsilon:.3,gamma:.9,alpha:.5,episodes:200,seed:7};
export const choices={objective:['satisfaction','clicks'],epsilon:[0,.1,.3],gamma:[0,.5,.9],alpha:[.1,.5],episodes:[60,200],seed:[7,19]};
const round=x=>Math.round(x*1e6)/1e6;
export function normalize(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('Expected a configuration object');
 for(const key of Object.keys(input))if(!Object.hasOwn(defaults,key))throw new RangeError('Unknown option: '+key);
 const c={...defaults,...input};for(const [key,values]of Object.entries(choices))if(!values.includes(c[key]))throw new RangeError('Invalid '+key);return c;
}
export function makeRandom(seed){let state=seed>>>0;return ()=>{state=(1664525*state+1013904223)>>>0;return state/4294967296;};}
export function tdUpdate(old,reward,nextMax,alpha,gamma,terminal){const target=reward+(terminal?0:gamma*nextMax);return {target,error:target-old,updated:old+alpha*(target-old)};}
function greedy(state,q){return data.states[state].reduce((best,a)=>q[state][a.id]>q[state][best.id]?a:best);}
export function evaluate(input={}){
 const config=normalize(input),rng=makeRandom(config.seed),q={},visits={};
 for(const [state,actions]of Object.entries(data.states)){q[state]={};visits[state]={};for(const a of actions){q[state][a.id]=0;visits[state][a.id]=0;}}
 const history=[],updates=[];let exploratorySteps=0,steps=0;
 for(let episode=1;episode<=config.episodes;episode++){
  let state='start',total=0,discounted=0,satisfaction=0,t=0;
  while(state!=='terminal'){
   const explore=rng()<config.epsilon,actions=data.states[state];
   const action=explore?actions[Math.floor(rng()*actions.length)]:greedy(state,q);
   const reward=action[config.objective],terminal=action.next==='terminal';
   const nextMax=terminal?0:Math.max(...Object.values(q[action.next]));
   const old=q[state][action.id],update=tdUpdate(old,reward,nextMax,config.alpha,config.gamma,terminal);
   q[state][action.id]=update.updated;visits[state][action.id]++;steps++;if(explore)exploratorySteps++;
   if(updates.length<12)updates.push({episode,state,action:action.id,reward,next:action.next,terminal,explore,old:round(old),nextMax:round(nextMax),target:round(update.target),error:round(update.error),updated:round(update.updated)});
   total+=reward;discounted+=config.gamma**t*reward;satisfaction+=action.satisfaction;t++;state=action.next;
  }
  history.push({episode,total,discounted:round(discounted),satisfaction,steps:t,qQuick:round(q.start.quick),qAsk:round(q.start.ask)});
 }
 // Evaluation freezes Q, removes exploration, and uses the same toy environment.
 const trace=[];let state='start',total=0,discounted=0,satisfaction=0,t=0;
 while(state!=='terminal'){
  const action=greedy(state,q),reward=action[config.objective];trace.push({state,action:action.id,label:action.label,reward,next:action.next});
  total+=reward;discounted+=config.gamma**t*reward;satisfaction+=action.satisfaction;t++;state=action.next;
 }
 // The oracle is for comparison only; these values never enter the updates.
 const knownBest=Math.max(...data.states.known.map(a=>a[config.objective]));
 const optimalQ={start:{quick:data.states.start[0][config.objective],ask:-1+config.gamma*knownBest},known:Object.fromEntries(data.states.known.map(a=>[a.id,a[config.objective]]))};
 const first=optimalQ.start.ask>optimalQ.start.quick?'ask':'quick',optimalReturn=optimalQ.start[first];
 const rows=Object.entries(data.states).flatMap(([s,actions])=>actions.map(a=>({state:s,action:a.id,label:a.label,q:round(q[s][a.id]),visits:visits[s][a.id],optimalQ:round(optimalQ[s][a.id])})));
 const curve=[];for(let i=0;i<history.length;i+=20){const block=history.slice(i,i+20);curve.push({episode:block.at(-1).episode,mean:round(block.reduce((sum,e)=>sum+e.total,0)/block.length)});}
 return {config,rows,history,updates,curve,steps,exploratorySteps,trainingMean:round(history.reduce((sum,e)=>sum+e.total,0)/history.length),greedy:{trace,total,discounted:round(discounted),satisfaction},optimal:{first,discounted:round(optimalReturn)},gap:round(Math.max(0,optimalReturn-discounted))};
}
