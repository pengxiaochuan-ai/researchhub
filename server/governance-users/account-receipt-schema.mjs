import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

export const accountReceiptSignature='public.researchhub_read_account_receipt(text,text,integer,text)';
export async function installAccountReceipt(tx,{tenantId}){
 if(typeof tenantId!=='string'||!/^[A-Za-z0-9_-]{1,160}$/.test(tenantId))throw Error('P2_RECEIPT_SCOPE_REJECTED');
 const [guard]=await tx.$queryRawUnsafe(`SELECT current_database() AS database,current_user AS owner,
  has_schema_privilege('aisci_app','public','CREATE') AS app_create,
  pg_has_role('aisci_app',current_user,'MEMBER') AS app_owner_member`);
 if(guard.database!=='wp01_test_full_baseline'||guard.owner!=='aisci_owner'||guard.app_create||guard.app_owner_member)throw Error('P2_RECEIPT_OWNER_REJECTED');
 const sql=readFileSync(new URL('./account-receipt.sql',import.meta.url),'utf8').replaceAll('__TENANT__',tenantId);
 const body=sql.split('$$')[1],marker='researchhub-account-receipt-v1:'+createHash('sha256').update(sql).digest('hex');
 const inspect=async()=>{
  const [row]=await tx.$queryRaw`SELECT p.prosrc AS body,p.prosecdef AS definer,p.proconfig AS config,
   p.provolatile AS volatility,p.proisstrict AS strict,p.proparallel AS parallel,
   p.pronargdefaults AS defaults,p.prorettype::regtype::text AS result_type,
   pg_get_userbyid(p.proowner) AS owner,obj_description(p.oid,'pg_proc') AS marker,
   has_function_privilege('aisci_app',p.oid,'EXECUTE') AS app_execute,
   EXISTS(SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) x
     WHERE x.privilege_type='EXECUTE' AND x.grantee NOT IN(p.proowner,(SELECT oid FROM pg_roles WHERE rolname='aisci_app'))) AS other_execute
   FROM pg_proc p WHERE p.oid=to_regprocedure(${accountReceiptSignature})`;
  return row;
 };
 const verify=row=>row?.body===body&&row.definer===true&&row.owner==='aisci_owner'&&
  row.volatility==='v'&&row.strict===false&&row.parallel==='u'&&row.defaults===0&&row.result_type==='jsonb'&&
  JSON.stringify(row.config)===JSON.stringify(['search_path=pg_catalog'])&&row.marker===marker&&row.app_execute===true&&row.other_execute===false;
 const prior=await inspect();
 if(prior){if(!verify(prior))throw Error('P2_RECEIPT_SCHEMA_DRIFT');return{applied:false,signature:accountReceiptSignature,marker};}
 await tx.$executeRawUnsafe(sql);
 await tx.$executeRawUnsafe(`REVOKE ALL ON FUNCTION ${accountReceiptSignature} FROM PUBLIC`);
 await tx.$executeRawUnsafe(`GRANT EXECUTE ON FUNCTION ${accountReceiptSignature} TO aisci_app`);
 await tx.$executeRawUnsafe(`COMMENT ON FUNCTION ${accountReceiptSignature} IS '${marker}'`);
 if(!verify(await inspect()))throw Error('P2_RECEIPT_SECURITY_INVALID');
 return{applied:true,signature:accountReceiptSignature,marker};
}
