import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {withRollback,runtime,direct as current} from '../wp02/test-support.mjs';
import {listObjectReviewQueue,submitObjectReview} from './object-review.mjs';
import {listVisibleClinicalRegistrySummaries,getCurrentExternalAiHit} from './external-visible.mjs';
import {submitExternalReview} from './external-review.mjs';
const tenantId=runtime.ids.tenant,hubKey='lingshu-xinyu';
const accounts=await current(db=>db.account.findMany({where:{tenantId,id:{in:[runtime.ids.admin,runtime.ids.owner]}},select:{id:true,authVersion:true}}));
const principal={tenantId,accountId:runtime.ids.admin,authVersion:accounts.find(x=>x.id===runtime.ids.admin).authVersion};
const owner={tenantId,accountId:runtime.ids.owner,authVersion:accounts.find(x=>x.id===runtime.ids.owner).authVersion};
const scope={tenantId,hubKey,principal,reviewerAccountId:principal.accountId};
const queue=async db=>(await listObjectReviewQueue({db,...scope})).filter(x=>x.kind==='external');
const input=x=>({kind:'external',mode:'display_only',visibility:'public',documentId:x.detail.id,expectedFingerprint:x.fingerprint,operationId:randomUUID()});
const aiRows=(db,id)=>db.$queryRaw`SELECT decision_version::text AS id,md5(to_jsonb(r)::text) AS hash FROM rh_source.external_review_decision r WHERE tenant_id=${tenantId} AND version_id=${id} AND purpose='ai_retrieval' ORDER BY decision_version`;

test('display-only restores the current clinical snapshot but never creates AI permission; replay and CAS remain safe',()=>withRollback(async({direct})=>direct(async db=>{
 await db.$executeRaw`SELECT set_config('app.tenant_id',${tenantId},true)`;
 let x=(await queue(db)).find(x=>x.subtitle==='ChiCTR2300073486');
 await db.$executeRaw`INSERT INTO rh_source.external_review_decision(tenant_id,hub_key,version_id,field_kind,purpose,audience,decision,evidence_ref,reviewer_id) VALUES(${tenantId},${hubKey},${x.detail.versionId},'bibliographic','ai_retrieval','public','revoke','https://example.org/display-only-rollback',${principal.accountId})`;
 x=(await queue(db)).find(x=>x.subtitle==='ChiCTR2300073486');
 const before=await aiRows(db,x.detail.versionId),request=input(x);
 await submitObjectReview({db,...scope,input:request});
 assert.deepEqual(await aiRows(db,x.detail.versionId),before,'AI decision rows must not change');
 const approved=(await queue(db)).find(y=>y.key===x.key);
 assert.equal(approved.state.status,'public_display');assert.equal(approved.canUpdateDisplayOnly,true);
 const one=(await listVisibleClinicalRegistrySummaries({db,...scope})).find(y=>y.documentId===x.detail.id);
 assert.equal(one.registrationSummary.registeredOn.value,'2023-07-12');
 assert.equal(await getCurrentExternalAiHit({db,tenantId,hubKey,principal:owner,documentId:x.detail.id}),null);
 assert.equal((await submitObjectReview({db,...scope,input:request})).replayed,true);
 await assert.rejects(()=>submitObjectReview({db,...scope,input:{...request,operationId:randomUUID()}}),/HUB_SOURCE_VERSION_CONFLICT/);
 await assert.rejects(()=>submitObjectReview({db,...scope,principal:{...principal,authVersion:principal.authVersion-1},input:input(approved)}),/HUB_SOURCE_REVIEW_AUTH_REQUIRED/);
 await assert.rejects(()=>submitExternalReview({db,...scope,input:{documentId:x.detail.id,versionId:x.detail.versionId,
   sha256:x.detail.sha256,fieldKind:'bibliographic',purpose:'ai_retrieval',decision:'approve',confirmed:true,
   evidenceRef:'https://example.org/blocked-legacy',expectedVersion:before.at(-1)?.id||'0'}}),/HUB_SOURCE_OBJECT_DECISION_REQUIRED/);
 const display=approved.detail.decisions.find(d=>d.purpose==='display'&&d.fieldKind==='bibliographic');
 await db.$executeRaw`UPDATE rh_source.external_review_decision SET evidence_ref='evidence://hub-display/00000000-0000-4000-8000-000000000000/${'a'.repeat(64)}' WHERE decision_version=${BigInt(display.version)}`;
 assert(!(await listVisibleClinicalRegistrySummaries({db,...scope})).find(y=>y.documentId===x.detail.id).registrationSummary,'mismatched display/detail cannot leak');
 await db.$executeRaw`UPDATE rh_source.external_review_decision SET evidence_ref=${display.evidenceRef} WHERE decision_version=${BigInt(display.version)}`;
 await db.$executeRaw`UPDATE rh_source.clinical_registry_detail_review SET expires_at='2000-01-01' WHERE extraction_id=${approved.detail.structuredExtraction.extractionId} AND evidence_ref=${display.evidenceRef}`;
 assert.equal((await queue(db)).find(y=>y.key===x.key).state.status,'partial');
 assert(!(await listVisibleClinicalRegistrySummaries({db,...scope})).find(y=>y.documentId===x.detail.id).registrationSummary);
})));

test('active AI only permits a fully-current unified public no-op; other sources/modes and invalid heads reject without changing AI',()=>withRollback(async({direct})=>direct(async db=>{
 await db.$executeRaw`SELECT set_config('app.tenant_id',${tenantId},true)`;
 let x=(await queue(db)).find(x=>x.subtitle==='ChiCTR2300077209');
 await submitObjectReview({db,...scope,input:{...input(x),mode:undefined}});
 x=(await queue(db)).find(x=>x.subtitle==='ChiCTR2300077209');
 const before=await aiRows(db,x.detail.versionId),hit=await getCurrentExternalAiHit({db,tenantId,hubKey,principal:owner,documentId:x.detail.id});
 assert.equal((await submitObjectReview({db,...scope,input:input(x)})).replayed,true);
 assert.deepEqual(await aiRows(db,x.detail.versionId),before);
 assert.deepEqual(await getCurrentExternalAiHit({db,tenantId,hubKey,principal:owner,documentId:x.detail.id}),hit);
 await db.$executeRaw`INSERT INTO rh_source.clinical_registry_detail_review(tenant_id,hub_key,extraction_id,decision,evidence_ref,reviewer_id) VALUES(${tenantId},${hubKey},${x.detail.structuredExtraction.extractionId},'revoke','https://example.org/rollback-revoke',${principal.accountId})`;
 x=(await queue(db)).find(x=>x.subtitle==='ChiCTR2300077209');
 await assert.rejects(()=>submitObjectReview({db,...scope,input:input(x)}),/HUB_SOURCE_DISPLAY_AI_REVIEW_REQUIRED/);
 await assert.rejects(()=>submitObjectReview({db,...scope,input:{...input(x),visibility:'tenant'}}),/HUB_SOURCE_REVIEW_INPUT_REJECTED/);
 await assert.rejects(()=>submitObjectReview({db,...scope,input:{...input(x),mode:'unknown'}}),/HUB_SOURCE_REVIEW_INPUT_REJECTED/);
 const guide=(await queue(db)).find(x=>x.detail.documentType!=='clinical_registry');
 await assert.rejects(()=>submitObjectReview({db,...scope,input:input(guide)}),/HUB_SOURCE_SCOPE_REJECTED/);
 assert.deepEqual(await aiRows(db,x.detail.versionId),before);
 await db.$executeRaw`UPDATE rh_source.clinical_registry_extraction SET payload_sha256=${'e'.repeat(64)} WHERE id=${x.detail.structuredExtraction.extractionId}`;
 const bad=(await queue(db)).find(y=>y.key===x.key);
 assert.equal(bad.canUpdateDisplayOnly,false);
 await assert.rejects(()=>submitObjectReview({db,...scope,input:input(bad)}),/HUB_SOURCE_SCOPE_REJECTED/);
})));
