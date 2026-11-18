// Correct one synthetic baseline through the existing versioned response commands.
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {openHarness,json,save,key,privateDir,evidenceDir} from './full-study-runtime.mjs';
assert.deepEqual(process.argv.slice(2),['--correct-baseline']);
const h=await openHarness(),b=json(privateDir+'bootstrap.json'),ident=json(privateDir+'identities.json'),initial=json(privateDir+'analysis-initial-result.json'),root='/research-studies/'+b.study.id,A=root+'/analysis',path=privateDir+'correction-journal.json';
assert.equal(initial.studyId,b.study.id);const journal=existsSync(path)?json(path):{studyId:b.study.id,steps:{}};assert.equal(journal.studyId,b.study.id);
async function op(name,url,body){let s=journal.steps[name];if(!s){s={url,body:{requestKey:key(),...body},status:'pending'};journal.steps[name]=s;save(path,journal);}if(s.status==='done')return s.result;const value=await h.post(url,s.body);Object.assign(s,{status:'done',result:value});save(path,journal);return value;}
try{
 const subject=b.subjects.find(s=>s.armCode==='MDD_TARGET'&&s.index===2)??b.subjects.find(s=>s.armCode==='MDD_TARGET'),visits=(await h.get(root+'/visits?limit=100')).items,visit=visits.find(v=>v.subject.id===subject.id&&v.visitPlan.code==='V1_PATIENT');assert(visit);
 const assignment=visit.assignments.find(a=>a.formVersionId===b.refs.phq.id);assert(assignment);const ap=root+'/assignments/'+assignment.id;
 if(!journal.before){journal.before={subjectId:subject.id,visit,capture:await h.get(ap)};const answer=journal.before.capture.response.answers.phq9_q1;assert(Number.isInteger(answer)&&answer>=0&&answer<=3);journal.patch={subjectId:subject.id,logicalVisit:'V1',form:'phq',fieldKey:'phq9_q1',before:answer,after:(answer+1)%4};journal.optionalClear={fieldKey:'functional_difficulty',before:journal.before.capture.response.answers.functional_difficulty,after:null};save(path,journal);}
 await h.loginActor(ident.accounts.reviewer);let capture=await h.get(ap);
 if(!journal.steps.unlock?.result)await op('unlock',ap+'/unlock',{expectedVersion:capture.response.version,expectedRef:capture.response.ref,reason:'整课题合成更正用例：解除本基线锁定并核对既有报告失效'});
 if(!journal.blocked){
  const blocked=[];for(const p of [A+'/reports/'+initial.artifactId,A+'/report-exports/'+initial.jobId,A+'/report-exports/'+initial.jobId+'/file']){const {value}=await h.request(p,{status:409});assert(['FULL_STUDY_VISIT_CHANGED','FULL_STUDY_SOURCE_NOT_LOCKED','ANALYSIS_BASIS_STALE'].includes(value?.code),JSON.stringify(value));blocked.push({path:p,status:409,code:value.code});}
  journal.blocked=blocked;save(path,journal);
 }
 await h.loginActor(ident.accounts.collector);capture=await h.get(ap);const answers={...journal.before.capture.response.answers,[journal.patch.fieldKey]:journal.patch.after,[journal.optionalClear.fieldKey]:null};
 await op('correct',ap+'/correct',{expectedVersion:capture.response.version,expectedRef:capture.response.ref,reason:'合成来源更正：按固定patch变更基线PHQ第1项、非计分功能题留空，保留原修订并重做统计交付；非真实临床数据',answers});
 await h.loginActor(ident.accounts.reviewer);capture=await h.get(ap);await op('review',ap+'/review',{expectedVersion:capture.response.version,expectedRef:capture.response.ref,decision:'approved'});capture=await h.get(ap);await op('lock',ap+'/lock',{expectedVersion:capture.response.version,expectedRef:capture.response.ref});
 const beforeReverify=(await h.get(root+'/visits/'+visit.id)).visit;await op('reverify',root+'/visits/'+visit.id+'/reverify',{expectedVersion:beforeReverify.version,reason:'本次合成基线修订已独立审阅并锁定，重新核对完成依据，不改原完成时间'});
 const finalVisit=(await h.get(root+'/visits/'+visit.id)).visit,final=await h.get(ap);assert.equal(finalVisit.status,'completed');assert.equal(finalVisit.completionIntegrity,'current');assert.equal(finalVisit.actualCompletedAt,journal.before.visit.actualCompletedAt);assert.notDeepEqual(final.response.ref,journal.before.capture.response.ref);
 const ref=journal.before.capture.response.ref,old=await h.get(ap+'/revisions/'+ref.revisionNo+'?'+new URLSearchParams({responseId:ref.responseId,contentHash:ref.contentHash}));assert.deepEqual(old.revision.answers,journal.before.capture.response.answers);
 const newRef=final.response.ref,newRevision=(await h.get(ap+'/revisions/'+newRef.revisionNo+'?'+new URLSearchParams({responseId:newRef.responseId,contentHash:newRef.contentHash}))).revision;assert.equal(final.response.answers.functional_difficulty,null);assert.equal(final.response.score.complete,true);
 const result={passed:true,syntheticOnly:true,studyId:b.study.id,patch:journal.patch,optionalClear:journal.optionalClear,oldRef:ref,newRef,oldScore:journal.before.capture.response.score,newScore:final.response.score,oldAnswers:journal.before.capture.response.answers,newAnswers:final.response.answers,newRevision,originalRevisionPreserved:true,completionDatePreserved:true,unscoredOptionalBlankPreserved:true,oldReportDeliveryBlocked:journal.blocked,visitId:visit.id,at:new Date().toISOString(),network:h.network};save(evidenceDir+'correction.json',result);save(privateDir+'correction.json',result);console.log(JSON.stringify({passed:true,oldReportDeliveryBlocked:true,originalRevisionPreserved:true,patch:journal.patch}));
}catch(e){save(evidenceDir+'correction-failure-'+key()+'.json',{at:new Date().toISOString(),message:String(e.message).slice(0,2000),network:h.network,journal:path});throw e;}
