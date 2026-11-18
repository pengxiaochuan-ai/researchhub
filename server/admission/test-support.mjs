// Tests only: DDL remains inside the caller's rollback transaction.
import {readFileSync} from 'node:fs';
import {createAdmissionService} from './service.mjs';
export async function registerTestAdmission(tx,account,key){
 const [state]=await tx.$queryRawUnsafe("SELECT to_regnamespace('rh_admission')::text AS schema");
 if(!state.schema)for(const sql of readFileSync(new URL('./schema.sql',import.meta.url),'utf8').split(/^-- statement\s*$/m))await tx.$executeRawUnsafe(sql.trim());
 const service=createAdmissionService({tenantId:account.tenantId,transact:()=>{throw Error('TEST_UNEXPECTED_TRANSACTION');},lockAuthorization:async()=>{}});
 return service.registerInTransaction(tx,account,key);
}
