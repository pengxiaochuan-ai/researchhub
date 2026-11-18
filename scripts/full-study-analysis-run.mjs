// Actual API -> Python Worker -> Artifact -> private storage -> fresh download. Synthetic scope only.
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {openHarness,json,save,key,sha,base,privateDir,evidenceDir} from './full-study-runtime.mjs';
import {fullStudyHash} from '../server/research-analysis/full-study-projection.mjs';
const round=process.argv[3],adoptedSnapshotId=process.argv[4]==='--snapshot-id'?process.argv[5]:null;assert(process.argv[2]==='--round'&&['initial','corrected'].includes(round)&&(process.argv.length===4||process.argv.length===6&&/^[A-Za-z0-9_-]{1,160}$/.test(adoptedSnapshotId)));
const h=await openHarness(),b=json(privateDir+'bootstrap.json'),ident=json(privateDir+'identities.json'),root='/research-studies/'+b.study.id,A=root+'/analysis',out=evidenceDir+'report-'+round+'/';mkdirSync(out,{recursive:true});
const statePath=privateDir+'analysis-'+round+'-journal.json',journal=existsSync(statePath)?json(statePath):{studyId:b.study.id,round,steps:{}};assert.equal(journal.studyId,b.study.id);
async function op(name,url,body,{status=200,timeoutMs=90000}={}){let s=journal.steps[name];if(!s){s={url,body:{requestKey:key(),...body},status:'pending'};journal.steps[name]=s;save(statePath,journal);}assert.equal(s.url,url);if(s.status==='done')return s.result;const value=(await h.request(url,{method:'POST',body:s.body,status,timeoutMs})).value;Object.assign(s,{status:'done',result:value});save(statePath,journal);return value;}
function oracle(args,name){const text=execFileSync('python3',args,{encoding:'utf8',timeout:30000,maxBuffer:2*1024*1024});writeFileSync(out+name+'-stdout.json',text);const result=JSON.parse(text);console.log(JSON.stringify({oracle:name,passed:result.passed,numericPassed:result.numericPassed,checks:result.checks,problems:result.problems?.length}));}
try{
 const clock=(await h.get(root+'/simulation/context')).simulation;assert.equal(clock.stageIndex,3);const visits=(await h.get(root+'/visits?limit=100')).items;assert.equal(visits.length,18);assert(visits.every(v=>v.status==='completed'&&v.completionIntegrity==='current'));
 const preview=await h.get(A+'/plans/'+b.planId+'/preview');assert.equal(preview.manifest.slices.length,54);assert.equal(preview.evaluation.blockingCount,0);save(out+'preview.json',preview);
 let released;
 if(adoptedSnapshotId){
  const actual=await h.get(A+'/snapshots/'+adoptedSnapshotId);assert.equal(actual.basis.studyId,b.study.id);assert.equal(actual.basis.planId,b.planId);assert.equal(actual.basis.manifestHash,preview.manifestHash);assert.equal(actual.qualityGate.status,'released');
  released={snapshotId:adoptedSnapshotId,manifestHash:actual.basis.manifestHash};journal.observedSnapshot={...released,source:'already released through the real UI',noReleaseRequestFabricated:true};
 }else released=await op('snapshot',A+'/plans/'+b.planId+'/snapshots',{previewHash:preview.manifestHash,reason:'本轮'+round+'四访视合成来源已逐项审核锁定，质量与固定修订核对通过'});
 journal.snapshotId=released.snapshotId;save(statePath,journal);
 const snapshot=await h.get(A+'/snapshots/'+released.snapshotId);save(out+'snapshot.json',snapshot);
 let group=await op('run-group',A+'/runs',{snapshotId:released.snapshotId});
 group=await h.get(A+'/runs/'+group.id);journal.runGroupId=group.id;save(statePath,journal);
 // A stopped client can leave a committed process receipt without a local response.
 // Resolve those exact requests before creating another process key.
 for(const [name,step]of Object.entries(journal.steps).filter(([name,s])=>name.startsWith('process-')&&s.status==='pending'))await op(name,step.url,step.body);
 group=await h.get(A+'/runs/'+group.id);
 while(group.remaining>0){assert(!['blocked','cancelled','failed'].includes(group.status));const before=group.remaining;group=await op('process-'+before,A+'/runs/'+group.id+'/process',{limit:1,expectedStateHash:group.stateHash});assert(group.remaining<before);console.log(JSON.stringify({round,processed:group.slices.filter(s=>s.methodRunId).length,remaining:group.remaining}));}
 assert(['needs_review','completed'].includes(group.status));
 const prereviewIds=group.slices.map(s=>s.methodRunId).filter(Boolean),prereviewRuns=await h.read(tx=>tx.researchMethodRun.findMany({where:{...b.scope,id:{in:prereviewIds}},orderBy:{id:'asc'}}));
 save(out+'group-pre-review.json',group);save(out+'actual-method-runs-pre-review.json',{studyId:b.study.id,runGroupId:group.id,runs:prereviewRuns});
 const correctionArgs=[];if(round==='corrected'){
  const c=json(privateDir+'correction.json'),events={events:[{subjectId:c.patch.subjectId,logicalVisit:c.patch.logicalVisit,form:c.patch.form,before:{[c.patch.fieldKey]:c.patch.before,...c.optionalClear?{[c.optionalClear.fieldKey]:c.optionalClear.before}:{}},patch:{[c.patch.fieldKey]:c.patch.after,...c.optionalClear?{[c.optionalClear.fieldKey]:c.optionalClear.after}:{}}}]};
  save(out+'oracle-corrections.json',events);correctionArgs.push('--corrections',out+'oracle-corrections.json');
 }
 const oracleArgs=['scripts/full-study-oracle.py','--actual-snapshot',out+'snapshot.json','--actual-group',out+'group-pre-review.json','--actual-runs',out+'actual-method-runs-pre-review.json',...correctionArgs,'--out',out+'oracle-pre-review'];
 oracle([...oracleArgs,'--pre-review'],'pre-review');assert.equal(json(out+'oracle-pre-review/comparison.json').numericPassed,true);
 const pendingReview=journal.steps['confirm-methods'];
 if(pendingReview?.status==='pending'&&group.status==='completed'&&group.reviewStatus==='confirmed'){
  // Recover a lost bulk response only from the exact committed native child receipts.
  // This changes the test client's journal, never application data or approvals.
  const ids=group.slices.map(s=>s.methodRunId).filter(Boolean),body=pendingReview.body;
  const proof=await h.read(async tx=>{
   const audits=await tx.auditLog.findMany({where:{...b.scope,accountId:h.actor.id,action:'research_method_run_review',target:{in:ids}},select:{id:true,target:true,meta:true}});
   const matched=ids.map(runId=>{const requestKey='full-review-'+fullStudyHash({requestKey:body.requestKey,runId}),a=audits.find(a=>a.target===runId&&a.meta?.requestKey===requestKey);assert(a&&a.meta.commandHash===fullStudyHash({runId,conclusion:body.conclusion,comment:body.comment.trim()}));return a;});
   const reviews=await tx.researchMethodReview.findMany({where:{...b.scope,id:{in:matched.map(a=>a.meta.reviewId)}}});assert.equal(reviews.length,ids.length);
   for(const a of matched){const r=reviews.find(r=>r.id===a.meta.reviewId);assert(r&&r.runId===a.target&&r.reviewerAccountId===h.actor.id&&r.conclusion===body.conclusion&&r.comment===body.comment.trim()&&r.version===a.meta.reviewVersion);}
   return{auditIds:matched.map(a=>a.id),reviewIds:reviews.map(r=>r.id),count:matched.length};
  });
  save(out+'review-client-recovery.json',{originalResponseLost:true,recoveredFrom:'current group API plus exact native child review receipts',businessDataWritten:false,requestKey:body.requestKey,...proof});
  Object.assign(pendingReview,{status:'done',result:group,recoveredFromNativeChildReceipts:true});save(statePath,journal);
 }
 await op('confirm-methods',A+'/runs/'+group.id+'/reviews',{conclusion:'confirmed',comment:'已核对本轮三个总分逐组逐访视及配对Δ的真实算子结果、有效分母与来源；仅软件合成模拟'}, {timeoutMs:600000});
 group=await h.get(A+'/runs/'+group.id);assert.equal(group.status,'completed');assert.equal(group.reviewStatus,'confirmed');save(out+'group.json',group);
 const methodIds=group.slices.map(s=>s.methodRunId).filter(Boolean),runs=await h.read(tx=>tx.researchMethodRun.findMany({where:{...b.scope,id:{in:methodIds}},orderBy:{id:'asc'}}));assert.equal(runs.length,methodIds.length);assert(runs.every(r=>r.status==='completed'&&r.reviewStatus==='confirmed'&&r.environment.llm===false&&r.executorVersion==='descriptive-v1'));save(out+'actual-method-runs.json',{studyId:b.study.id,runGroupId:group.id,runs});
 oracle(['scripts/full-study-oracle.py','--actual-snapshot',out+'snapshot.json','--actual-group',out+'group.json','--actual-runs',out+'actual-method-runs.json',...correctionArgs,'--out',out+'oracle-final'],'final');assert.equal(json(out+'oracle-final/comparison.json').passed,true);
 await h.loginActor(ident.accounts.manager);
 const created=await op('report-create',A+'/reports',{runGroupId:group.id,title:'抑郁症多模态课题 · 四访视合成模拟'+(round==='corrected'?'更正后':'')+'验收报告'});journal.artifactId=created.artifactId;save(statePath,journal);
 await h.loginActor(ident.accounts.reviewer);
 await op('report-review',A+'/reports/'+created.artifactId+'/reviews',{versionNo:1,decision:'approved',reason:'独立审阅合成场景、固定三量表、分母/缺失和双端来源，未作为临床结论'});
 await op('report-release',A+'/reports/'+created.artifactId+'/releases',{versionNo:1,reason:'本轮合成流程报告审核通过，允许交付核对'});
 const exported=await op('report-export',A+'/reports/'+created.artifactId+'/exports',{versionNo:1,format:'docx'},{timeoutMs:180000});journal.jobId=exported.jobId;save(statePath,journal);
 const job=await h.get(A+'/report-exports/'+exported.jobId);assert.equal(job.status,'ready',JSON.stringify({status:job.status,errorCode:job.errorCode}));
 const report=await h.get(A+'/reports/'+created.artifactId);assert.equal(report.status,'released');assert.equal(report.runGroupId,group.id);save(out+'report.json',report);save(out+'export.json',job);
 const cookie=json(privateDir+'admin-session.json').cookie,r=await fetch(base+'/api'+A+'/report-exports/'+job.jobId+'/file',{headers:{Cookie:cookie},signal:AbortSignal.timeout(120000),redirect:'error'});assert.equal(r.status,200);const bytes=Buffer.from(await r.arrayBuffer());assert.equal(r.headers.get('x-file-sha256'),job.file.sha256);assert.equal(sha(bytes),job.file.sha256);assert.equal(bytes.length,job.file.sizeBytes);writeFileSync(out+'report.docx',bytes);
 const result={technicalPassed:true,businessAcceptance:'pending_user_review',syntheticOnly:true,clinicalAcceptance:false,productionAcceptance:false,studyId:b.study.id,round,planId:b.planId,snapshotId:released.snapshotId,runGroupId:group.id,methodRunCount:runs.length,artifactId:created.artifactId,jobId:job.jobId,wordPath:out+'report.docx',sha256:job.file.sha256,sizeBytes:bytes.length,independentReportReviewer:ident.accounts.reviewer.id,reportCreator:ident.accounts.manager.id,network:h.network,at:new Date().toISOString(),externalEmailSent:false,paidModelCalls:false};save(out+'result.json',result);save(privateDir+'analysis-'+round+'-result.json',result);console.log(JSON.stringify({technicalPassed:true,round,methodRunCount:runs.length,wordPath:result.wordPath}));
}catch(e){save(out+'failure-'+key()+'.json',{at:new Date().toISOString(),message:String(e.message).slice(0,2200),network:h.network,journal:statePath});throw e;}
