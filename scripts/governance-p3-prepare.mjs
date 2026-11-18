// One user-approved P3 Study only. Never calls a historical fixture initializer.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
assert.deepEqual(process.argv.slice(2),['--local-synthetic']);
const root=new URL('../../',import.meta.url).pathname,base='http://127.0.0.1:19501';
const{env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const dir=root+'.tmp/researchhub-p3/',file=dir+'fixture.json',out=root+'researchhub/docs/testing/evidence/governance-p3-2026-11-13/';mkdirSync(dir,{recursive:true,mode:0o700});mkdirSync(out,{recursive:true});
const journal=existsSync(file)?JSON.parse(readFileSync(file)):{runId:'rh-p3-20261113',tenantId:runtime.ids.tenant,requests:{},network:[],syntheticOnly:true};
assert.equal(journal.tenantId,runtime.ids.tenant);assert.equal(journal.runId,'rh-p3-20261113');assert.equal(journal.syntheticOnly,true);
const persist=()=>writeFileSync(file,JSON.stringify(journal,null,2)+'\n',{mode:0o600});
const cookies={};
async function request(role,path,method='GET',body,expected=200){
 const r=await fetch(base+'/api'+path,{method,headers:{Cookie:cookies[role]??'',Origin:base,Accept:'application/json',...(body?{'Content-Type':'application/json','X-ResearchHub-Request':'session-v1'}:{})},...(body?{body:JSON.stringify(body)}:{})}),data=await r.json();
 if(path==='/auth/login'){assert.equal(r.status,201);cookies[role]=r.headers.get('set-cookie')?.split(';')[0];assert(cookies[role]);return data;}
 journal.network.push({path,method,status:r.status,code:data.code??null,time:new Date().toISOString()});persist();assert.equal(r.status,expected,data.message??path);return data;
}
async function command(name,role,path,method,body,expected=200){if(!journal.requests[name]){journal.requests[name]={path,method,body:{...body,requestKey:randomUUID()},expected};persist();}const q=journal.requests[name];assert.equal(q.path,path);assert.equal(q.method,method);return request(role,path,method,q.body,q.expected);}
try{
 for(const role of ['owner','admin'])await request(role,'/auth/login','POST',{tenantSlug:runtime.ids.tenant,username:role+'@example.org',password:runtime.password},201);
 const context=await request('owner','/research-projects/context'),group=context.creationGroups.find(g=>g.id===runtime.ids.group);assert(group,'P3_EXISTING_CREATION_GROUP_NOT_AVAILABLE');
 journal.groupId=group.id;
 const intent=(await command('intent','owner','/research-projects','POST',{title:'P3内部方案审核合成验收20261113',question:'内部审核退回、批准、启用及决定溯源的软件验证；不涉及真实受试者。',hubKey:'lingshu-xinyu'},201)).item;journal.intentId=intent.id;persist();
 journal.study=(await command('study','owner','/research-projects/'+intent.id+'/studies','POST',{expectedVersion:intent.version,studyGroupId:group.id})).item.study;persist();
 const scope={tenantId:runtime.ids.tenant,studyGroupId:group.id,researchProjectId:journal.study.executionProjectId},prefix=journal.runId;
 if(!journal.refs){
  journal.refs=await withFixtureTransaction(env,'direct',async tx=>{
   assert(await tx.researchProject.findFirst({where:{id:scope.researchProjectId,tenantId:scope.tenantId,studyGroupId:scope.studyGroupId,name:intent.title}}));
   assert.equal(await tx.formTemplate.count({where:{id:prefix+'-template'}}),0);
   const template=await tx.formTemplate.create({data:{...scope,id:prefix+'-template',key:prefix,name:'P3合成审核表单',createdBy:runtime.ids.admin}});
   const form=await tx.formVersion.create({data:{...scope,id:prefix+'-form',templateId:template.id,versionNumber:1,status:'published',lockedAt:new Date(),createdBy:runtime.ids.admin,schema:{schemaVersion:'form-schema.v1',fields:[{key:'value',label:'观察值',type:'number',required:true}]}}});
   const outcome=await tx.outcomeDefinition.create({data:{...scope,id:prefix+'-outcome',key:prefix,versionNumber:1,name:'合成观察值',role:'primary',sourceType:'data_field',dataFieldKey:'value',timepointCode:'BASELINE',status:'published',publishedAt:new Date(),publishedBy:runtime.ids.admin}});
   await tx.$executeRaw`INSERT INTO wp01_meta.fixture_run(run_id,manifest) VALUES(${prefix},${JSON.stringify({purpose:'P3 user-approved one synthetic Study and two versions',syntheticOnly:true,scope,studyId:journal.study.id})}::jsonb)`;
   return{form:form.id,outcome:outcome.id};
  });persist();
 }
 journal.protocols??=[];
 for(let i=0;i<2;i++){
  const p=(await command('protocol-'+i,'owner','/research-studies/'+journal.study.id+'/protocols','POST',{title:i?'P3合成审核方案 · 待审版本':'P3合成审核方案 · 决定溯源',purpose:'仅P3具名合成软件验收，无真实受试者。',primaryOutcomes:[{outcomeDefinitionId:journal.refs.outcome,versionNumber:1}],secondaryOutcomes:[],methodsSummary:'核对固定方案与审核过程',populationSummary:'无真实受试者',statisticsSummary:'不执行统计分析',visitPlans:[{code:'BASELINE',name:'基线访视',sequence:1,anchor:'enrollment',targetDayOffset:0,windowBeforeDays:0,windowAfterDays:0,required:true,allowRepeat:false,requirements:[{kind:'form_response',code:'P3',name:'P3合成审核表单',required:true,config:{formVersionId:journal.refs.form}}]}]})).protocol;
  journal.protocols[i]=p;persist();const path='/research-studies/'+journal.study.id+'/protocols/'+p.id;
  const na={status:'not_applicable',source:'用户批准的P3具名合成软件案例',reason:'仅验证软件，无真实受试者和临床用途'},sections=Object.fromEntries(['ethics','screening','researchConsent','dataUse','withdrawal','safety','blinding'].map(k=>[k,na]));
  sections.site={status:'configured',source:'P3具名合成案例',reason:'单一研究范围',mode:'study_wide'};
  sections.captureReview={status:'configured',source:'P3具名合成案例',reason:'纯合成软件验证',rules:{correction:'保留修订和原因',locking:'审阅后锁定',unlocking:'记录理由',reviewResponsibility:'当前有权人员负责',reviewIndependence:'not_required'}};
  await command('policy-'+i,'admin',path+'/policy','PUT',{expectedPolicyId:null,sections});
  const checked=await command('check-'+i,'admin',path+'/check','POST',{expectedRevision:p.revision});assert.equal(checked.check.gate.ready,true);
  const submitted=await command('submit-'+i,'admin',path+'/submit','POST',{expectedRevision:p.revision});assert.equal(submitted.protocol.status,'pending_review');
 }
 journal.prepared=true;persist();writeFileSync(out+'prepare.json',JSON.stringify({passed:true,studyId:journal.study.id,protocolIds:journal.protocols.map(p=>p.id),network:journal.network,paidCalls:0,newAccounts:0,newRoles:0,newStudyCount:1,syntheticOnly:true},null,2));
 console.log(JSON.stringify({passed:true,studyId:journal.study.id,protocolIds:journal.protocols.map(p=>p.id),newRoles:0,paidCalls:0}));
}catch(e){persist();writeFileSync(out+'prepare-failure-'+Date.now()+'.json',JSON.stringify({passed:false,error:e.message,network:journal.network,studyId:journal.study?.id,paidCalls:0},null,2));console.error(JSON.stringify({passed:false,error:e.message}));process.exitCode=1;}
