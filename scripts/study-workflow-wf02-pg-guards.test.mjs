// Offline guards and exact-copy comparator only. No simulated PG success or mocked native service claims.
import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePgArgs,runWF02PgPrediction,assertExactProtocolCopy} from './study-workflow-wf02-pg.mjs';
const windows={STUDY_WORKFLOW_WF02_QA_WINDOW:'explicit',VISIT_WORKFLOW_QA_WINDOW:'explicit'};
const args=(code='A',mode='success')=>['--local-synthetic','--rollback-predict','--case',code,'--mode',mode];
test('PG module requires two root windows, rollback-predict and exactly one registered case/mode',()=>{
 assert.deepEqual(parsePgArgs(['--help'],{}),{help:true});assert.throws(()=>parsePgArgs(args(),{}),/ROOT_WF02/);
 assert.throws(()=>parsePgArgs(args(),{STUDY_WORKFLOW_WF02_QA_WINDOW:'explicit'}),/SHARED_HELPER/);
 for(const code of ['A','B','D'])for(const mode of ['success','partial-failure','stale-source','stale-target','denied'])assert.deepEqual(parsePgArgs(args(code,mode),windows),{code,mode});
 for(const invalid of [args('Bseed'),args('A','commit'),['--local-synthetic','--predict','--case','A','--mode','success'],[...args(),'--all']])assert.throws(()=>parsePgArgs(invalid,windows));
});
test('missing window rejects before external protection, fixture function or native imports can be reached',async()=>{
 let called=0;
 await assert.rejects(runWF02PgPrediction({args:args(),windowEnv:{},readProtection:()=>{called++;},withFixtureTransaction:()=>{called++;}}),/ROOT_WF02/);
 assert.equal(called,0);
});
function copyFixture(){
 const protocol={id:'source-protocol',status:'executing',title:'Synthetic contract',purpose:'No clinical data',methodsSummary:null,populationSummary:null,statisticsSummary:null,primaryOutcomes:[{outcomeDefinitionId:'source-outcome',versionNumber:1}],secondaryOutcomes:[],
  visitPlans:[{id:'source-visit',code:'BASE',name:'Synthetic visit',sequence:1,anchor:null,anchorEventKey:null,targetDayOffset:0,windowBeforeDays:0,windowAfterDays:0,required:false,allowRepeat:false,requirements:[{id:'source-requirement',kind:'form_response',code:'F',name:'Synthetic form',required:false,config:{formVersionId:'source-form',allowedCaptureModes:['researcher']}}]}]};
 const form={id:'source-form',templateId:'source-template',versionNumber:1,status:'published',schema:{fields:[{key:'test',value:0,optional:false,label:null}]},scoring:null,template:{name:'Synthetic form',description:null}};
 const outcome={id:'source-outcome',key:'synthetic',versionNumber:1,name:'Synthetic mapping',role:'primary',sourceType:'form',scaleVersionId:null,scoreKey:null,dataFieldKey:'test',unit:null,direction:null,timepointCode:'BASE'};
 const source={protocol,forms:[form],outcomes:[outcome]},target=structuredClone(source);target.protocol.id='target-protocol';target.protocol.status='draft';target.protocol.primaryOutcomes[0].outcomeDefinitionId='target-outcome';
 const visit=target.protocol.visitPlans[0];visit.id='target-visit';visit.requirements[0].id='target-requirement';visit.requirements[0].config.formVersionId='target-form';
 const f=target.forms[0];f.id='target-form';f.status='locked';f.lockedAt='synthetic-lock';Object.assign(f.template,{sourceKind:'tenant_published',sourceTemplateId:'source-template',sourceVersionId:'source-form'});
 target.outcomes[0].id='target-outcome';target.outcomes[0].status='published';target.outcomes[0].publishedAt='synthetic-publish';
 return{source,target,origin:{forms:[{sourceVersionId:'source-form',targetVersionId:'target-form',reused:false}],outcomes:[{sourceOutcomeId:'source-outcome',targetOutcomeId:'target-outcome',reused:false}]}};
}
test('exact-copy comparator preserves 0/null/false, null scoring, units and every fixed reference',()=>{
 const f=copyFixture();assert.deepEqual(Object.fromEntries(Object.entries(assertExactProtocolCopy(f.source,f.target,f.origin)).filter(([k])=>!k.endsWith('Hash'))),{forms:1,outcomes:1,plans:1,requirements:1});
 for(const alter of [f=>f.target.forms[0].scoring={algorithm:'numeric-sum'},f=>f.target.forms[0].schema.fields[0].value=null,f=>f.target.forms[0].schema.fields[0].optional=true,f=>f.target.outcomes[0].unit='invented-unit',f=>f.target.protocol.visitPlans[0].required=true,f=>f.target.protocol.visitPlans[0].requirements[0].config.formVersionId='source-form',f=>f.target.protocol.visitPlans[0].id='source-visit',f=>f.origin.forms.push(f.origin.forms[0])]){
  const current=copyFixture();alter(current);assert.throws(()=>assertExactProtocolCopy(current.source,current.target,current.origin));
 }
});
