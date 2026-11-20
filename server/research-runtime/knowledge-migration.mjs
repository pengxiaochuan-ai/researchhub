// Operator-only, read-only preparation of the single approved K01 extension.
import {createHash}from'node:crypto';
import {validateChatAdmission}from'./chat-budget.mjs';
import {k01PrefixHash,migrateK01Budget}from'./chat-k01-budget.mjs';
export const K01_OLD_SHA='fd96111fd68a7658b79c12dcaf23437ee9ced0bd1ca1af6093dacb8e4d9e23c4';
export const K01_OLD_LEDGER_SHA='b37a00f199bd2358424ea23cfde08e23b94f1dd2358eea3bcc70058c178ac098';
const hashes={admin:{md:'740c449454d26fef8e0d67227fdfa9149bdbe5b0c2114ba6c1f394b297a3aa59',pdf:'3b83d035edc68e9c2593a400dee1168a535ab1c87bae741cc4be52d927ce1988'},owner:{md:'743b0ba14e59c8d9c3e3d28467c7107f6f724a836be94e3a92f6a185cb2b60e8',pdf:'edc10bafa65d30529aa9122d6bd9dee5a27a4be059aea857281b924d249dd2dc'}};
const sha=x=>createHash('sha256').update(x).digest('hex');
const need=(x,code)=>{if(!x)throw Error(code);};
export async function prepareKnowledgeMigration({tx,oldAdmissionRaw,oldLedgerRaw,input}){
 need(sha(oldAdmissionRaw)===K01_OLD_SHA&&sha(oldLedgerRaw)===K01_OLD_LEDGER_SHA,'K01_ORIGINAL_FILES_CHANGED');
 const old=validateChatAdmission(JSON.parse(oldAdmissionRaw)),previous=JSON.parse(oldLedgerRaw);
 need(input&&Object.keys(input).sort().join(',')==='bindings,issuedAt'&&Number.isFinite(Date.parse(input.issuedAt))&&new Date(input.issuedAt).toISOString()===input.issuedAt&&Date.parse(input.issuedAt)<=Date.now(),'K01_INPUT_REJECTED');
 const admission={...old,schema:'hub-chat-admission.v2',coreDigest:'55d56847c17af69fe4616613cb46e0cdc3ae263f9d7a205f267290c504a94669',limits:{sessions:4,jobs:6,dispatches:4,feeMicros:1000000},legacy:{admission:old,admissionSha:K01_OLD_SHA,prefixHash:k01PrefixHash(previous)},k01:{...input,studyGroupId:'rh-kb-local-b0e2af9d-group',researchProjectId:'rh-kb-local-b0e2af9d-project'}};
 validateChatAdmission(admission);const raw=JSON.stringify(admission)+'\n',admissionSha=sha(raw),ledger=migrateK01Budget({previous,admission,admissionSha});
 await validateKnowledgeFixtures(tx,admission);
 for(const j of previous.jobs){const job=await tx.knowledgeChatJob.findFirst({where:{id:j.id,tenantId:old.tenantId,accountId:j.accountId,sessionId:j.sessionId,requestKey:j.requestKey}});need(job?.status==='failed'&&Boolean(job.completedAt),'K01_ORIGINAL_JOB_NOT_TERMINAL');}
 const [historical]=await tx.$queryRawUnsafe(`SELECT count(*)::int AS count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY id),'')) AS hash FROM public.knowledge_chat_job t WHERE "tenantId"=$1 AND id=ANY($2::text[])`,old.tenantId,old.historicalChatIds);
 need(historical.count===623&&historical.hash==='735bdccbbc401c67285f0dd9714a2bed','K01_HISTORICAL_QUEUE_CHANGED');
 return{admission,admissionRaw:raw,admissionSha,ledger,ledgerRaw:JSON.stringify(ledger)+'\n',previousAdmissionSha:K01_OLD_SHA,previousLedgerSha:sha(oldLedgerRaw),historical};
}
export async function validateKnowledgeFixtures(tx,admission){
 const old=admission.legacy.admission,input=admission.k01;
 for(const binding of admission.k01.bindings){
  const role=binding.accountId.endsWith('-admin')?'admin':'owner',kb=await tx.knowledgeBase.findFirst({where:{id:binding.kbId,tenantId:old.tenantId,studyGroupId:admission.k01.studyGroupId,researchProjectId:admission.k01.researchProjectId,ownerAccountId:binding.accountId,visibility:'private'}});
  need(kb&&kb.name===`K01 原创合成资料·${role}·20261120`&&new Date(kb.createdAt).getTime()>=Date.parse(input.issuedAt),'K01_KB_BINDING_REJECTED');
  const docs=await tx.knowledgeDoc.findMany({where:{kbId:kb.id}});
  need(docs.length===2&&docs.every(d=>d.tenantId===old.tenantId&&d.studyGroupId===admission.k01.studyGroupId&&d.createdBy===binding.accountId&&!d.trashedAt&&!d.reviewed&&d.version>=1&&d.version<=3),'K01_NEW_DOCUMENTS_REJECTED');
  const positive=docs.find(d=>d.id===binding.positiveDocId);need(positive&&sha(positive.contentMd)===hashes[role].md,'K01_MD_CONTENT_CHANGED');
  const imports=await tx.knowledgeImportTask.findMany({where:{kbId:kb.id},include:{sourceFile:true}});need(imports.length===1,'K01_IMPORT_COUNT_REJECTED');const task=imports[0],source=task.sourceFile;
  need(task.id===binding.importTaskId&&task.status==='queued'&&!task.executionToken&&!task.workerOwner&&!task.leaseExpiresAt&&!task.docId&&task.createdBy===binding.accountId&&task.tenantId===old.tenantId&&task.studyGroupId===admission.k01.studyGroupId&&new Date(task.createdAt).getTime()>=Date.parse(input.issuedAt)&&source&&source.sha256===hashes[role].pdf&&source.extension==='pdf'&&source.createdBy===binding.accountId&&source.kbId===kb.id&&!source.docId,'K01_PDF_IMPORT_REJECTED');
 }
}
