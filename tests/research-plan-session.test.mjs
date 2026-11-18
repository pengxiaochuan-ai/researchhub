import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canUseResearchPlans,createKnowledgeClient} from '../src/knowledge-session.js';
import {validateResearchPico,isResearchPlanDirty,keepResearchPlanEditBase} from '../src/research-plan-form.js';
const scope={studyGroupId:'g',researchProjectId:'p'},user={studyGroups:[{id:'g',role:{menuPermissions:['knowledge','workbench','artifacts'],buttonPermissions:['chat.use','artifact.read','artifact.create','artifact.edit']},researchProjects:[{id:'p'}]}]};
test('background refresh cannot advance the CAS base underneath unsaved edits, but access loss is immediate',()=>{
 assert.equal(keepResearchPlanEditBase(true,4,{version:5,sourceStatus:'current'}),true);
 for(const [dirty,version,state]of [[false,5,'current'],[true,4,'current'],[true,5,'restricted'],[true,5,'stale']])assert.equal(keepResearchPlanEditBase(dirty,4,{version,sourceStatus:state}),false);
});
test('PICO validation focuses missing values and undoing edits clears dirty',()=>{
 const pico={question:'是否可行？',p:'成人',i:'针灸',c:'常规治疗',o:'症状变化'},base={pico,editor:'已保存'};
 assert.equal(validateResearchPico({...pico,c:''}).firstInvalid,'c');assert.equal(validateResearchPico(pico).valid,true);
 assert.equal(isResearchPlanDirty(pico,'已保存',base),false);assert.equal(isResearchPlanDirty({...pico,o:'修改'},'已保存',base),true);assert.equal(isResearchPlanDirty(pico,'编辑后内容',base),true);
});
test('candidate UI needs actual scope and all approved permissions, not admin display identity',()=>{
 assert.equal(canUseResearchPlans(user,scope),true);assert.equal(canUseResearchPlans({...user,role:'tenant_admin',studyGroups:[]},scope),false);
 assert.equal(canUseResearchPlans(user,{...scope,researchProjectId:'foreign'}),false);
 assert.equal(canUseResearchPlans({...user,studyGroups:[{...user.studyGroups[0],role:{...user.studyGroups[0].role,buttonPermissions:['chat.use']}}]},scope),false);
});
test('client exposes only bounded candidate routes, never review/export or generic artifacts',async()=>{
 const calls=[],client=createKnowledgeClient({scope:()=>scope,fetchImpl:async(path,init)=>{calls.push({path,method:init.method});return{ok:true,headers:new Headers({'Content-Type':'application/json'}),json:async()=>({ok:true})};}});
 await client.post('/research-plan-drafts',{});await client.get('/research-plan-drafts/plan');await client.get('/research-plan-drafts?limit=20');for(const sub of ['jobs','pico-confirmations','versions'])await client.post('/research-plan-drafts/plan/'+sub,{});
 for(const path of ['/research-artifacts','/research-plan-drafts/plan/review','/research-plan-drafts/plan/export','/research-plan-drafts/../foreign'])await assert.rejects(client.post(path,{}));
 await assert.rejects(client.del('/research-plan-drafts/plan'));assert.equal(calls.length,6);
});
