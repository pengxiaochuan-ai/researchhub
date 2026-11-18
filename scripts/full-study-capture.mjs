// One stage at a time. Original request keys are durable; no direct capture writes.
import assert from 'node:assert/strict';import {existsSync,readFileSync} from 'node:fs';
import {openHarness,json,save,key,privateDir,evidenceDir} from './full-study-runtime.mjs';
const stageIndex=Number(process.argv[3]);assert(process.argv[2]==='--stage'&&process.argv.length===4&&Number.isInteger(stageIndex)&&stageIndex>=0&&stageIndex<=3);
const h=await openHarness(),b=json(privateDir+'bootstrap.json'),ids=json(privateDir+'identities.json'),data=json(privateDir+'generator.json'),stage=['V1','V2','V3','V4'][stageIndex],root='/research-studies/'+b.study.id;
const path=privateDir+'capture-'+stage+'-journal.json',journal=existsSync(path)?json(path):{studyId:b.study.id,stage,steps:{},visits:[]};assert.equal(journal.studyId,b.study.id);
async function op(name,url,body){let s=journal.steps[name];if(!s){s={url,body:{requestKey:key(),...body},status:'pending'};journal.steps[name]=s;save(path,journal);}assert.equal(s.url,url);if(s.status==='done')return s.result;const result=await h.post(url,s.body);Object.assign(s,{status:'done',result});save(path,journal);return result;}
try{
 const clock=(await h.get(root+'/simulation/context')).simulation;assert.equal(clock.stageIndex,stageIndex,'WRONG_STAGE_DO_NOT_REPLAY_PRIOR_STAGE_WRITES');
 await h.loginActor(ids.accounts.collector);
 if(stageIndex===0){const csv=readFileSync(privateDir+'v1-healthy-phq-batch.csv','utf8'),preview=await h.post(root+'/imports/preview',{formVersionId:b.refs.phq.id,csv});
  if(!journal.steps['healthy-csv']?.result){assert.deepEqual(preview.errors,[]);await op('healthy-csv',root+'/imports',{formVersionId:b.refs.phq.id,csv,previewHash:preview.previewHash});}
 }
 const visits=(await h.get(root+'/visits?limit=100')).items.filter(v=>b.manifest.visitPlans.find(p=>p.id===v.visitPlan.id)?.logicalVisit===stage);
 assert.equal(visits.length,stageIndex===0?6:4);
 for(const visit of visits){
  const subject=b.subjects.find(s=>s.id===visit.subject.id),sample=data.data.find(s=>s.subjectId===subject.id).visits[stage];assert(sample);await h.loginActor(ids.accounts.collector);
  const vp=root+'/visits/'+visit.id;let current=(await h.get(vp)).visit;
  if(current.status!=='completed'){
   if(current.status!=='in_progress')await op(visit.id+'-start',vp+'/start',{expectedVersion:current.version});
   for(const req of current.visitPlan.requirements.filter(r=>r.kind==='form_response')){
    const formName=Object.keys(b.refs).find(name=>b.refs[name].id===req.config.formVersionId);assert(formName);
    current=(await h.get(vp)).visit;let assignment=current.assignments.find(a=>a.formVersionId===req.config.formVersionId);
    if(stageIndex===1&&formName==='phq'){
     const address=(b.runId+'-'+subject.armCode+'-'+subject.index).toLowerCase()+'@example.test';assert(address.startsWith(b.runId+'-')&&/^[a-z0-9._-]+@example\.test$/.test(address));
     if(!assignment){const invite=await op(visit.id+'-h5-email',vp+'/email-invitations',{formVersionId:b.refs.phq.id,address,emailConsentConfirmed:true});assert.equal(invite.delivery.status,'accepted','LOCAL_SMTP_NOT_ACCEPTED_STOP_NO_RESEND');assignment={id:invite.assignmentId};}
     const view=await h.get(root+'/assignments/'+assignment.id);if(view.response.status!=='submitted'){
      journal.h5Pending??=[];if(!journal.h5Pending.some(p=>p.assignmentId===assignment.id))journal.h5Pending.push({subjectId:subject.id,visitId:visit.id,assignmentId:assignment.id,address,answers:sample.phq});save(path,journal);continue;
     }
    }else{
     if(!assignment){const assigned=await op(visit.id+'-'+formName+'-assign',vp+'/assignments',{formVersionId:req.config.formVersionId});assignment={id:assigned.result.id};}
     const ap=root+'/assignments/'+assignment.id;let view=await h.get(ap);
     if(view.response.status==='draft')await op(assignment.id+'-submit',ap+'/submit',{expectedVersion:view.response.version,answers:formName==='fang'&&sample.fangInitial?sample.fangInitial:sample[formName]});
     if(formName==='fang'&&sample.fangInitial&&!journal.steps[assignment.id+'-correct']?.result){view=await h.get(ap);assert.equal(view.response.score.processingStatus,'review_required');await op(assignment.id+'-correct',ap+'/correct',{expectedVersion:view.response.version,expectedRef:view.response.ref,reason:'合成来源核对：两脉同有改正为原设计的单脉；保留原待复核修订',answers:sample.fang});}
    }
   }
   for(const [modality,file]of Object.entries(sample.modalities)){
    const receipt=await op(visit.id+'-'+modality+'-upload',vp+'/files/preprocessed',{filename:file.filename,modality,contentBase64:Buffer.from(file.csv).toString('base64')});assert.equal(receipt.storageIntegrity.status,'verified');
    const tasks=await h.get(vp+'/files/'+receipt.fileId+'/tasks');assert(tasks.items.some(t=>t.id===receipt.taskId&&t.status==='complete'&&t.featureCount>0&&t.quality.status==='reported'&&t.quality.alerts===0&&t.quality.missing===0),'REAL_FEATURE_TASK_QUALITY_CHAIN_REQUIRED');
    save(evidenceDir+'file-'+receipt.fileId+'.json',{syntheticOnly:true,visitId:visit.id,modality,receipt,tasks});
   }
   current=(await h.get(vp)).visit;const missing=[];for(const a of current.assignments){const view=await h.get(root+'/assignments/'+a.id);if(view.response.status!=='submitted')missing.push(a.id);}
   if(missing.length){journal.waitingForH5=true;save(path,journal);continue;}
   await h.loginActor(ids.accounts.reviewer);
   for(const a of current.assignments){const ap=root+'/assignments/'+a.id;let view=await h.get(ap);if(view.response.review!=='approved')await op(a.id+'-review',ap+'/review',{expectedVersion:view.response.version,expectedRef:view.response.ref,decision:'approved'});view=await h.get(ap);if(!view.response.locked)await op(a.id+'-lock',ap+'/lock',{expectedVersion:view.response.version,expectedRef:view.response.ref});}
   current=(await h.get(vp)).visit;await op(visit.id+'-complete',vp+'/complete',{expectedVersion:current.version,notes:'本轮合成逻辑'+stage+'访视；实际认证/审计为真实时间，不称临床随访完成'});
  }
  const final=(await h.get(vp)).visit;assert.equal(final.status,'completed');assert.equal(final.completionIntegrity,'current');if(!journal.visits.includes(visit.id))journal.visits.push(visit.id);save(path,journal);
 }
 const all=(await h.get(root+'/visits?limit=100')).items.filter(v=>b.manifest.visitPlans.find(p=>p.id===v.visitPlan.id)?.logicalVisit===stage),done=all.every(v=>v.status==='completed'&&v.completionIntegrity==='current');
 journal.waitingForH5=!done&&stageIndex===1;save(path,journal);save(evidenceDir+'capture-'+stage+'-result.json',{passed:done,waitingForH5:!done&&stageIndex===1,at:new Date().toISOString(),studyId:b.study.id,syntheticOnly:true,stage,stageIndex,logicalDate:clock.logicalDate,visits:all,network:h.network,emailChannel:stageIndex===1?'actual loopback SMTP only':'none',externalEmailSent:false});console.log(JSON.stringify({passed:done,stage,completed:all.filter(v=>v.status==='completed').length,total:all.length,waitingForH5:!done&&stageIndex===1}));
}catch(error){const failure={at:new Date().toISOString(),stage,studyId:b.study.id,message:String(error.message).slice(0,2000),network:h.network,journal:path};save(evidenceDir+'capture-'+stage+'-failure-'+key()+'.json',failure);save(evidenceDir+'capture-'+stage+'-failure.json',failure);throw error;}
