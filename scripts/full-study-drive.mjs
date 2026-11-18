// Same single synthetic Study; durable original request keys, no state rewrites.
import assert from 'node:assert/strict';import {existsSync} from 'node:fs';
import {openHarness,json,save,key,privateDir,evidenceDir,purpose} from './full-study-runtime.mjs';
import {requestHash} from '../server/research-studies/contract.mjs';import {fullStudyHash,validateFullStudyCase} from '../server/research-analysis/full-study-projection.mjs';
const mode=process.argv[2];assert(['--register','--activate'].includes(mode)&&process.argv.length===3);
const h=await openHarness(),b=json(privateDir+'bootstrap.json'),ids=json(privateDir+'identities.json'),path=privateDir+'drive-journal.json',journal=existsSync(path)?json(path):{studyId:b.study.id,steps:{}};assert.equal(journal.studyId,b.study.id);
const root='/research-studies/'+b.study.id,pp=root+'/protocols/'+b.protocol.id;
async function op(name,url,body,method='POST'){
 let step=journal.steps[name];if(!step){step={url,method,body:{requestKey:key(),...body},status:'pending'};journal.steps[name]=step;save(path,journal);}assert.equal(step.url,url);assert.equal(step.method,method);
 if(step.status==='done')return step.result;
 const result=(await h.request(url,{method,body:step.body})).value;Object.assign(step,{status:'done',result});save(path,journal);return result;
}
try{
 if(mode==='--register'){
  await h.loginActor(ids.accounts.manager);
  const configured=rules=>({status:'configured',source:'本轮授权的整课题合成模拟规格',reason:'明确合成规则，不代表真实临床启用',rules}),na={status:'not_applicable',source:'本轮合成软件验收',reason:'无真实受试者或临床干预'};
  const sections={ethics:na,safety:na,blinding:na,screening:configured({criteria:'按登记的六例显式设计组核对合成对象，不从分数推断诊断',decisionMethod:'manual'}),researchConsent:configured({textVersion:'full-study-synthetic-consent-v1',evidenceRequirement:'本轮合成确认记录'}),dataUse:configured({purposes:'整课题合成软件验证',scope:'synthetic-research-only'}),withdrawal:configured({effectiveRule:'停止新采集',retentionRule:'保留合成历史',futureUseRule:'限制新用途'}),site:{status:'configured',source:'新独立合成组',reason:'单Study模拟范围',mode:'study_wide'},captureReview:configured({correction:'保留修订、固定来源与理由',locking:'审阅后锁定',unlocking:'受控记录理由',reviewResponsibility:'合成独立审阅员',reviewIndependence:'not_required'}),populationSchedule:configured({schemaVersion:'population-schedule-v1',armVisitCodes:{MDD_TARGET:['V1_PATIENT','V2','V3','V4'],MDD_NON_TARGET:['V1_PATIENT','V2','V3','V4'],HEALTHY_REFERENCE:['V1_HEALTHY']}}),simulation:configured({schemaVersion:'study-simulation-clock-v1',stageDays:[0,14,28,56],timezone:'Asia/Shanghai'})};
  const policy=(await op('typed-policy',pp+'/policy',{expectedPolicyId:null,sections},'PUT')).policy;
  b.policy=policy;b.manifest.policyId=policy.id;b.manifest.policyHash=policy.contentHash;b.manifest=validateFullStudyCase(b.manifest);b.caseHash=fullStudyHash(b.manifest);save(privateDir+'bootstrap.json',b);
  await h.direct(async tx=>{
   const [marker]=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${b.runId}`;assert.equal(marker.manifest.purpose,purpose);assert.equal(marker.manifest.studyId,b.study.id);
   const old=await tx.auditLog.findFirst({where:{id:b.registrationAuditId}});if(old){assert.equal(old.meta.caseHash,b.caseHash);assert.deepEqual(old.meta.case,b.manifest);return;}
   await tx.auditLog.create({data:{id:b.registrationAuditId,...b.scope,accountId:b.registrationActorId,action:'researchhub.simulation.register',target:b.study.id,meta:{caseId:b.caseId,caseHash:b.caseHash,case:b.manifest,fixtureRunId:b.runId,syntheticOnly:true,realStudyEnabled:false}}});
  });
  const checked=await op('protocol-check',pp+'/check',{expectedRevision:b.protocol.revision});assert.equal(checked.check.gate.ready,true,JSON.stringify(checked.check.gate));
  const submitted=await op('protocol-submit',pp+'/submit',{expectedRevision:b.protocol.revision});await h.loginActor(ids.accounts.reviewer);
  const approved=await op('protocol-approve',pp+'/approve',{expectedRevision:submitted.protocol.revision,policyVersionId:policy.id,expectedPolicyHash:policy.contentHash});b.protocol=approved.protocol;b.phase='registered-protocol-approved-awaiting-analysis-plan';
 }else{
  assert(b.policy&&b.caseHash); // openHarness authenticates the existing authorized tenant admin.
  const config=await h.get(root+'/analysis/configuration');assert.equal(config.schemaVersion,'full-study-simulation-v2');
  const submitted=await op('analysis-plan',root+'/analysis/plans',{definition:{schemaVersion:'full-study-simulation-v2',caseId:b.caseId,protocolVersionId:b.protocol.id,sapVersion:'full-study-sap-v2',variableMapVersion:'full-study-variables-v1',reason:'六例固定合成设计；三总分独立分母、健康仅基线、患者配对变化；不声明临床主要终点或推断效力'}});
  b.planId=submitted.planId;await op('analysis-plan-approve',root+'/analysis/plans/'+b.planId+'/reviews',{expectedSequence:0,decision:'approved',reason:'核对本轮合成case、来源、分组适用性和特殊缺项规则；无临床启用'});
  await h.loginActor(ids.accounts.manager);b.protocol=(await op('protocol-activate',pp+'/activate',{expectedRevision:b.protocol.revision,migrateExisting:false})).protocol;
  b.enrollments={};
  for(const subject of b.subjects){const p=root+'/subjects/'+subject.id+'/participation',effectiveAt=new Date(new Date(b.manifest.baseDate).getTime()-1000).toISOString();
   for(const event of [{kind:'screening',decision:'passed',method:'manual'},{kind:'research_consent',decision:'granted',signer:'合成主体',textVersion:'full-study-synthetic-consent-v1'},{kind:'data_use_consent',decision:'granted',signer:'合成主体',scope:'synthetic-research-only'}])await op(subject.id+'-'+event.kind,p+'/events',{expectedPolicyVersionId:b.policy.id,expectedPolicyHash:b.policy.contentHash,event:{...event,effectiveAt,evidence:'本轮登记合成对象软件确认，无真实患者'}});
   b.enrollments[subject.id]=await op(subject.id+'-enroll',p+'/enroll',{expectedPolicyVersionId:b.policy.id,expectedPolicyHash:b.policy.contentHash,armCode:subject.armCode});
  }
  b.visits=(await h.get(root+'/visits?limit=100')).items;assert.equal(b.visits.length,18);for(const s of b.subjects)assert.equal(b.visits.filter(v=>v.subject.id===s.id).length,s.armCode==='HEALTHY_REFERENCE'?1:4);
  b.simulation=(await h.get(root+'/simulation/context')).simulation;assert.equal(b.simulation.stageIndex,0);b.phase='activated-six-enrolled-v1-ready';
 }
 save(privateDir+'bootstrap.json',b);save(evidenceDir+'bootstrap.json',b);save(evidenceDir+mode.slice(2)+'-result.json',{passed:true,at:new Date().toISOString(),studyId:b.study.id,phase:b.phase,syntheticOnly:true,protocol:b.protocol,caseHash:b.caseHash,planId:b.planId??null,simulation:b.simulation??null,network:h.network,emailSent:false});console.log(JSON.stringify({passed:true,phase:b.phase,evidence:evidenceDir+mode.slice(2)+'-result.json'}));
}catch(error){save(evidenceDir+mode.slice(2)+'-failure.json',{at:new Date().toISOString(),code:error.code??null,message:String(error.message).slice(0,2500),network:h.network,studyId:b.study.id,journal:path});throw error;}
