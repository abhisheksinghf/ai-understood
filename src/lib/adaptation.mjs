import data from '../../public/downloads/chapter-27-adaptation/data.json' with {type:'json'};
export {data};
export const designKeys=['rag','readTool','writeTool','fineTune'];
export const configFlags=['writeAction','behaviorGap','baselineTested','examplesReady','evalReady'];
export function validateConfig(config){
 if(!config||Object.keys(config).length!==6||!data.knowledge.some(k=>k.id===config.knowledge)||configFlags.some(k=>typeof config[k]!=='boolean'))throw new Error('Invalid requirement configuration.');
}
export function plan(config){
 validateConfig(config);
 const docs=['documents','documents_live'].includes(config.knowledge),live=['live','documents_live'].includes(config.knowledge);
 const missing=config.behaviorGap?['baselineTested','examplesReady','evalReady'].filter(k=>!config[k]):[];
 const status=!config.behaviorGap?'Not indicated':!config.baselineTested?'Build the baseline':missing.length?'Prepare evidence':'Trial candidate';
 const suggestedDesign={rag:docs,readTool:live,writeTool:config.writeAction,fineTune:status==='Trial candidate'};
 return {config:{...config},methods:['prompt',...designKeys.filter(k=>suggestedDesign[k])],suggestedDesign,fineTuning:{status,missing},requirements:[{id:'prompt',label:'Instructions and supplied context',covered:true},...(docs?[{id:'rag',label:'Document evidence',covered:false}]:[]),...(live?[{id:'readTool',label:'Current external state',covered:false}]:[]),...(config.writeAction?[{id:'writeTool',label:'Authorized state change',covered:false}]:[])],checks:[...data.commonChecks,...(docs?data.documentChecks:[]),...(live?data.liveChecks:[]),...(config.writeAction?data.actionChecks:[]),...(config.behaviorGap?data.behaviorChecks:[])]};
}
export function assess(config,design){
 if(!design||Object.keys(design).length!==4||designKeys.some(k=>typeof design[k]!=='boolean'))throw new Error('Invalid design selection.');
 const p=plan(config),requirements=p.requirements.map(r=>({...r,covered:r.id==='prompt'||design[r.id]})),missing=requirements.filter(r=>!r.covered).map(r=>r.id),extras=designKeys.filter(k=>design[k]&&!p.suggestedDesign[k]);
 const adaptationIssue=design.fineTune&&p.fineTuning.status!=='Trial candidate';
 return {design:{...design},requirements,missing,extras,adaptationIssue,verdict:missing.length?'Missing required capability':adaptationIssue?'Revisit adaptation choice':'Inputs and actions covered'};
}
