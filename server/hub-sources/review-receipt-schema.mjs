import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
export const receiptReadSignature='rh_source.read_review_receipt(text,text,text,integer,text,text)';
// Caller must already hold the local fixture transaction guard. No runtime DDL.
export async function installReceiptRead(db,{tenantId,reviewerAccountId}){
 if(![tenantId,reviewerAccountId].every(x=>typeof x==='string'&&/^[A-Za-z0-9_-]{4,100}$/.test(x)))throw Error('HUB_SOURCE_SCOPE_REJECTED');
 const [guard]=await db.$queryRawUnsafe(`SELECT current_database() AS database,current_user AS owner,
   has_schema_privilege('aisci_app','rh_source','CREATE') AS app_create,
   pg_has_role('aisci_app',current_user,'MEMBER') AS app_owner_member`);
 if(guard.database!=='wp01_test_full_baseline'||guard.owner!=='aisci_owner'||guard.app_create||guard.app_owner_member)throw Error('HUB_SOURCE_RECEIPT_OWNER_REJECTED');
 const sql=readFileSync(new URL('./review-receipt-read.sql',import.meta.url),'utf8').replaceAll('__TENANT__',tenantId).replaceAll('__REVIEWER__',reviewerAccountId);
 const marker='researchhub-source-receipt-read-v1:'+createHash('sha256').update(sql).digest('hex');
 const [prior]=await db.$queryRaw`SELECT obj_description(to_regprocedure(${receiptReadSignature}),'pg_proc') AS marker,to_regprocedure(${receiptReadSignature})::text AS name`;
 if(prior?.name){
  if(prior.marker===marker)return{applied:false,signature:receiptReadSignature};
  // Only our immediately preceding, locally installed P1 definition may be narrowed.
  if(prior.marker!=='researchhub-source-receipt-read-v1:f1b436fc9c07b7a7affa716ba7cb9e9a38b0bc8706e2040fa78715768df81c56')throw Error('HUB_SOURCE_RECEIPT_SCHEMA_DRIFT');
 }
 await db.$executeRawUnsafe(prior?.name?sql.replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION'):sql);
 await db.$executeRawUnsafe(`REVOKE ALL ON FUNCTION ${receiptReadSignature} FROM PUBLIC`);
 await db.$executeRawUnsafe(`GRANT EXECUTE ON FUNCTION ${receiptReadSignature} TO aisci_app`);
 await db.$executeRawUnsafe(`COMMENT ON FUNCTION ${receiptReadSignature} IS '${marker}'`);
 return{applied:true,signature:receiptReadSignature};
}
