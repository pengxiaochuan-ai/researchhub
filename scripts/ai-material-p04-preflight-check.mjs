// Real app-role READ ONLY proof, using synthetic buffers; never uploads/imports.
import assert from 'node:assert/strict';import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';import {createRequire} from 'node:module';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {createNativeResearchDataPreflight} from './ai-research-data-preflight.mjs';
import {materialDigest} from '../server/ai-agent/session-material-contract.mjs';
const root='/Users/mac/aisciencesys/',out='.tmp/ai-file-data-2026-11-12/p04-readonly-'+Date.now();mkdirSync(out,{recursive:true,mode:0o700});
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const {ids}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8'));
const prior=JSON.parse(readFileSync('.tmp/ai-file-data-2026-11-12/p02-browser-1794503079959/result.json','utf8'));
const require=createRequire(root+'app/server/package.json');require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});
const load=(path,name)=>require(root+'app/server/src/'+path+'.ts')[name],engine=createNativeResearchDataPreflight({load,require}),XLSX=require('xlsx');
const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['subject_id','score','flag','unit'],['P04-SYN-01',0,false,null],['P04-SYN-02',null,true,'unknown']]),'合成预检');
const files=[{fileId:'p04-synthetic-csv',filename:'p04-synthetic.csv',buffer:Buffer.from('subject_id,score,flag\nP04-SYN-03,0,false\nP04-SYN-04,,true\n')},{fileId:'p04-synthetic-xlsx',filename:'p04-synthetic.xlsx',buffer:XLSX.write(wb,{type:'buffer',bookType:'xlsx'})}];
const results=[];
for(const actor of ['owner','admin']){
 const result=await withFixtureTransaction(env,'app',async tx=>{
  await tx.$queryRawUnsafe(`SELECT set_config('app.tenant_id',$1,true),set_config('app.study_group_id',$2,true),set_config('app.research_project_id',$3,true),set_config('app.account_id',$4,true)`,ids.tenant,ids.group,ids.project,ids[actor]);
  const [mode]=await tx.$queryRawUnsafe('SHOW transaction_read_only');assert.equal(mode.transaction_read_only,'on');
  const account=await tx.account.findUnique({where:{id:ids[actor]},select:{id:true,tenantId:true,status:true,authVersion:true,role:true}});assert.equal(account.status,'active');assert.equal(account.tenantId,ids.tenant);
  const membership=await tx.studyGroupMembership.findFirst({where:{tenantId:ids.tenant,studyGroupId:ids.group,accountId:ids[actor],status:'active'},select:{role:{select:{menuPermissions:true,buttonPermissions:true,status:true}}}});assert.equal(membership.role.status,'active');
  const bindings=await tx.$queryRawUnsafe('SELECT id,project_intent_id,execution_project_id,study_group_id FROM rh_research.study_binding WHERE tenant_id=$1 AND execution_project_id=$2 AND study_group_id=$3',ids.tenant,ids.project,ids.group);
  const scope={tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project};
  const snapshot=async()=>{
   const selected={subject:await tx.subject.count({where:scope}),studyEnrollment:await tx.studyEnrollment.count({where:scope}),subjectVisit:await tx.subjectVisit.count({where:scope}),processingTask:await tx.processingTask.count({where:scope}),feature:await tx.feature.count({where:{tenantId:ids.tenant,subject:scope}}),modelJob:await tx.knowledgeChatJob.count({where:{...scope,accountId:ids[actor]}}),reservation:await tx.tokenQuotaReservation.count({where:{tenantId:ids.tenant,accountId:ids[actor]}})};
   return{counts:selected,hash:materialDigest(selected)};
  };
  const before=await snapshot(),principal={tenantId:ids.tenant,accountId:ids[actor],authVersion:account.authVersion,sessionId:prior.uploads.find(x=>x.actor===actor&&x.format==='txt').sessionId};
  // Current generic Study resolver does not enable import. Neither read nor an
  // admin role is promoted into a new permission in this internal proof.
  const preview=engine.preview(principal,{files,destinations:[]});
  assert.equal(preview.destination,null);assert.equal(preview.confirmationReady,false);assert.equal(preview.files[1].rows[0].values[1],0);assert.equal(preview.files[1].rows[0].values[2],false);
  assert.deepEqual(await snapshot(),before);
  return{actor,readOnly:true,appRole:true,role:account.role,hasDataUpload:membership.role.buttonPermissions.some(p=>['*','data.upload'].includes(p)),hasDataMenu:membership.role.menuPermissions.some(p=>['*','data'].includes(p)),bindings,before,after:await snapshot(),preview};
 },{readOnly:true});results.push(result);
}
writeFileSync(out+'/result.json',JSON.stringify({passed:true,syntheticOnly:true,results,modelCalls:0,operatorCalls:0,formalWrites:0,httpEnabled:false},null,2),{mode:0o600});
console.log(JSON.stringify({passed:true,evidence:out,accounts:results.map(r=>({actor:r.actor,readOnly:r.readOnly,hasDataUpload:r.hasDataUpload,studyBindings:r.bindings.length,files:r.preview.files.length})),modelCalls:0,operatorCalls:0,formalWrites:0,httpEnabled:false}));
