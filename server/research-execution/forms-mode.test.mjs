import test from 'node:test';
import assert from 'node:assert/strict';
import {createProtocolConfigurationService} from './protocols.mjs';
import {listCaptureCandidates} from '../research-capture/forms.mjs';

function fixture(algorithm){
 const ctx={tenantId:'t',studyGroupId:'g',executionProjectId:'p',projectIntentId:'i',capabilities:{canConfigure:true}};
 const tx={$queryRaw:async()=>[],account:{findFirst:async()=>({role:'tenant_admin',isTenantAdmin:true})},tenantFeatureEntitlement:{findFirst:async()=>({id:'enabled'})},formVersion:{findMany:async()=>[{id:'f',status:'published',versionNumber:1,template:{id:'template',key:'form',name:'固定表单'},schema:{fields:[]},scoring:{algorithm}}]},scaleVersion:{findMany:async()=>[]},outcomeDefinition:{findMany:async()=>[]}};
 const studies={withResearchStudyTransaction:async(_u,_s,_a,fn)=>fn(tx,ctx)},core={createProtocolVersionInTransaction:async()=>{throw Error('SYNTHETIC_CORE_REACHED');}};
 return{tx,ctx,service:createProtocolConfigurationService({studies,core})};
}
const body=modes=>({requestKey:'synthetic-mode-guard',title:'合成方案',visitPlans:[{code:'V1',name:'基线',sequence:1,requirements:[{kind:'form_response',code:'F',name:'固定表单',config:{formVersionId:'f',...(modes?{allowedCaptureModes:modes}:{})}}]}]});
test('candidate modes reflect clinician table5 while PHQ and previous forms retain both modes',async()=>{
 for(const algorithm of ['fang-2023-table5-v1','numeric-sum-v1',undefined]){
  const {tx,ctx}=fixture(algorithm),result=await listCaptureCandidates(tx,ctx);
  assert.deepEqual(result.forms[0].allowedCaptureModes,algorithm==='fang-2023-table5-v1'?['researcher']:['researcher','patient_h5']);
 }
});
test('direct protocol create cannot configure clinician table5 for H5 or mixed entry',async()=>{
 for(const modes of [['patient_h5'],['researcher','patient_h5']])await assert.rejects(fixture('fang-2023-table5-v1').service.create({accountId:'a'},'s',body(modes)),{code:'FORM_CAPTURE_MODE_NOT_SUPPORTED'});
 for(const [algorithm,modes] of [['fang-2023-table5-v1',['researcher']],['fang-2023-table5-v1',undefined],['numeric-sum-v1',['patient_h5']],['numeric-sum-v1',['researcher','patient_h5']]])await assert.rejects(fixture(algorithm).service.create({accountId:'a'},'s',body(modes)),/SYNTHETIC_CORE_REACHED/);
});
