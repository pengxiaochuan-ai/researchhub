// Install explicit form-score software-check outcomes; never claim a clinical primary endpoint.
import assert from 'node:assert/strict';
import {openHarness,key,json,save,privateDir,evidenceDir,purpose} from './full-study-runtime.mjs';
assert.deepEqual(process.argv.slice(2),['--prepare']);const h=await openHarness(),b=json(privateDir+'bootstrap.json'),ident=json(privateDir+'identities.json');
assert(b.syntheticOnly&&b.protocol.status==='draft');assert(!b.manifest.outcomes,'SCORE_OUTCOMES_ALREADY_INSTALLED');
await h.read(async tx=>{const [row]=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${b.runId}`;assert.equal(row.manifest.purpose,purpose);assert.equal(row.manifest.studyId,b.study.id);});
await h.loginActor(ident.accounts.manager);
const outcomes=await h.direct(async tx=>{
 const rows=[];
 for(const variable of b.manifest.variables){
  const primary=variable.key==='phq9_total',name=primary?'模拟流程主核对指标·PHQ-9总分（非临床主要终点）':'模拟流程次核对指标·'+variable.label+'（非临床主要终点）';
  const row=await tx.outcomeDefinition.create({data:{...b.scope,key:b.runId+'-'+variable.key,versionNumber:1,name,role:primary?'primary':'secondary',sourceType:'form_score',scoreKey:variable.key,dataFieldKey:null,scaleVersionId:null,unit:'分',timepointCode:'V1_PATIENT',status:'published',publishedAt:new Date(),publishedBy:ident.accounts.manager.id,createdBy:ident.accounts.manager.id}});
  rows.push({id:row.id,versionNumber:1,variableKey:variable.key,role:row.role});
 }
 await tx.auditLog.create({data:{...b.scope,accountId:ident.accounts.manager.id,action:'synthetic_fixture.full_study.form_score_outcomes.install',target:b.study.id,meta:{purpose,runId:b.runId,caseId:b.caseId,syntheticOnly:true,clinicalPrimaryEndpointFrozen:false,outcomes:rows}}});return rows;
});
save(privateDir+'score-outcomes-checkpoint.json',{outcomes});
const fields=['title','purpose','primaryOutcomes','secondaryOutcomes','methodsSummary','populationSummary','statisticsSummary','visitPlans'],body=Object.fromEntries(fields.map(k=>[k,b.protocol[k]]));
body.primaryOutcomes=outcomes.filter(o=>o.role==='primary').map(({id,versionNumber})=>({outcomeDefinitionId:id,versionNumber}));body.secondaryOutcomes=outcomes.filter(o=>o.role==='secondary').map(({id,versionNumber})=>({outcomeDefinitionId:id,versionNumber}));
body.statisticsSummary+=' 主/次核对指标仅为软件模拟的固定总分，不代表已冻结临床主要终点/AUC。';
const value=(await h.request('/research-studies/'+b.study.id+'/protocols/'+b.protocol.id+'/configuration',{method:'PUT',body:{requestKey:key(),expectedRevision:b.protocol.revision,...body}})).value;
b.protocol=value.protocol;b.manifest.protocolHash=value.protocol.revision;b.manifest.outcomes=outcomes;b.phase='prepared-score-outcomes-awaiting-typed-policy-and-core';b.network.push(...h.network);b.limitations=['protocol仍为draft；form_score源由父ResearchHub私有受控checker装配后方可check/approve','未保存typedpolicy、未登记case、未审批分析计划、未启用协议、未入组/采集'];
save(privateDir+'bootstrap.json',b);save(evidenceDir+'bootstrap.json',b);save(evidenceDir+'score-outcomes.json',{at:new Date().toISOString(),syntheticOnly:true,clinicalPrimaryEndpointFrozen:false,outcomes,protocolId:b.protocol.id,protocolHash:b.protocol.revision,network:h.network});
await h.direct(tx=>tx.$executeRaw`UPDATE wp01_meta.fixture_run SET manifest=manifest||${JSON.stringify({phase:b.phase,protocolHash:b.protocol.revision,outcomes})}::jsonb WHERE run_id=${b.runId}`);
console.log(JSON.stringify({prepared:true,phase:b.phase,studyId:b.study.id,protocolId:b.protocol.id,outcomes:outcomes.length,clinicalPrimaryEndpointFrozen:false}));
