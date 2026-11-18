import {createHash} from 'node:crypto';
import {assertNamedReviewer} from './pmc-review-service.mjs';
import {assertCurrentReviewer} from './review-service.mjs';

// Narrow receipt read approved for the dedicated synthetic target only.
// Runtime performs no DDL and never bypasses the original audit RLS directly.

const fail=code=>{throw Error(code);};
const action='researchhub.source_review.receipt',schemaVersion='hub-source-review-receipt.v1';
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const receiptId=({principal,tenantId,hubKey},key)=>'rh-source-review-'+hash([tenantId,hubKey,principal.accountId,key]);
const canonical=input=>Object.keys(input).sort().map(key=>[key,input[key]]);
const fields={pmc:['versionId','rawSha256','visibility','expectedVersion','expectedAssetFingerprint','operationId'],external:['kind','documentId','mode','visibility','expectedFingerprint','operationId'],workbook:['kind','batchId','sourceRegistryId','sourceRecordId','visibility','expectedFingerprint','operationId']};
async function authorize(args){assertNamedReviewer(args.principal,args.tenantId,args.reviewerAccountId);await assertCurrentReviewer(args);}
async function find(args,id){
 const {db,tenantId,principal}=args;
 let row;
 try{[row]=await db.$queryRaw`SELECT rh_source.read_review_receipt(${tenantId},${args.hubKey},${principal.accountId},${principal.authVersion}::integer,${id},${args.operationId??args.input?.operationId}) AS meta`;}
 catch(error){if(error.meta?.message?.includes('HUB_SOURCE_REVIEW_AUTH_REQUIRED'))fail('HUB_SOURCE_REVIEW_AUTH_REQUIRED');throw error;}
 if(!row?.meta)return null;
 if(!['pmc','external','workbook'].includes(row.meta.kind)||!row.meta.input||!row.meta.review)fail('HUB_SOURCE_RECEIPT_INVALID');
 return row.meta;
}

// Must share the caller's transaction with the original review service. No
// second decision table, retrospective receipts, or current-state inference.
export async function submitWithReviewReceipt(args,submit){
 await authorize(args);
 const {db,principal,tenantId,hubKey,input,kind}=args;
 if(kind==='pmc'&&input?.operationId===undefined)return submit(); // Legacy API remains unchanged.
 if(!fields[kind]||!input||!uuid(input.operationId)||Object.keys(input).some(key=>!fields[kind].includes(key))||Object.values(input).some(value=>value!==null&&!['string','number'].includes(typeof value))||Buffer.byteLength(JSON.stringify(input))>16384)fail('HUB_SOURCE_REVIEW_INPUT_REJECTED');
 const id=receiptId(args,input.operationId),requestHash=hash([kind,canonical(input)]);
 await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id},0))::text AS locked`;
 const prior=await find(args,id);
 if(prior){if(hash([prior.kind,canonical(prior.input)])!==requestHash)fail('HUB_SOURCE_REQUEST_KEY_CONFLICT');return prior.review;}
 const review=JSON.parse(JSON.stringify(await submit()));
 const target=kind==='pmc'?input.versionId:kind==='external'?input.documentId:input.sourceRecordId??input.batchId;
 // INSERT without RETURNING: Hub-level audit rows are insertable but deliberately
 // invisible through ordinary SELECT RLS. Never broaden SELECT for an ORM return.
 await db.$executeRaw`INSERT INTO public.audit_log(id,"tenantId","accountId",action,target,meta,"researchProjectId")
   VALUES(${id},${tenantId},${principal.accountId},${action},${target},${JSON.stringify({schemaVersion,hubKey,kind,requestHash,input,review})}::jsonb,NULL)`;
 return review;
}

export async function readReviewReceipt(args){
 await authorize(args);
 if(!uuid(args.operationId))fail('HUB_SOURCE_REVIEW_INPUT_REJECTED');
 const saved=await find(args,receiptId(args,args.operationId));
 if(!saved)fail('HUB_SOURCE_RECEIPT_NOT_FOUND');
 return{kind:saved.kind,input:saved.input,review:saved.review};
}
