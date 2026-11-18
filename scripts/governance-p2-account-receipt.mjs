import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {installAccountReceipt,accountReceiptSignature} from '../server/governance-users/account-receipt-schema.mjs';

const action=process.argv[2];
if(!['check','apply'].includes(action)||process.argv.length!==3)throw Error('Usage: node scripts/governance-p2-account-receipt.mjs check|apply');
const root=fileURLToPath(new URL('../../',import.meta.url));
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const {ids}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8'));
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const preserve=async tx=>({
 policies:await tx.$queryRawUnsafe("SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname"),
 tables:await tx.$queryRawUnsafe("SELECT c.relname,c.relacl::text AS acl,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname"),
 sourceReader:await tx.$queryRawUnsafe("SELECT pg_get_functiondef('rh_source.read_review_receipt(text,text,text,integer,text,text)'::regprocedure) AS definition"),
 roles:await tx.$queryRawUnsafe("SELECT rolname,rolsuper,rolbypassrls FROM pg_roles WHERE rolname IN ('aisci_app','aisci_owner') ORDER BY rolname"),
});
const report=await withFixtureTransaction(env,'direct',async tx=>{
 const identity=(await tx.$queryRawUnsafe('SELECT current_database() AS database,current_user AS role,clock_timestamp() AS time'))[0];
 const before=digest(await preserve(tx));
 const result=action==='apply'?await installAccountReceipt(tx,{tenantId:ids.tenant}):{applied:false,signature:accountReceiptSignature};
 const after=digest(await preserve(tx));assert.equal(after,before,'P2_OLD_RLS_ACL_OR_SOURCE_DRIFT');
 const [installed]=await tx.$queryRaw`SELECT p.prosecdef,pg_get_userbyid(p.proowner) AS owner,p.proconfig,
  has_function_privilege('aisci_app',p.oid,'EXECUTE') AS app_execute,
  EXISTS(SELECT 1 FROM aclexplode(p.proacl) x WHERE x.grantee=0 AND x.privilege_type='EXECUTE') AS public_execute
  FROM pg_proc p WHERE p.oid=to_regprocedure(${accountReceiptSignature})`;
 return{action,...result,identity,installed:installed??null,preservedSha256:before};
},{readOnly:action==='check'});
const out=root+'researchhub/docs/testing/evidence/governance-p2-account-receipt-2026-11-13/'+action+'-'+randomUUID().slice(0,8);
mkdirSync(out,{recursive:true});writeFileSync(out+'/result.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,evidence:out+'/result.json'}));
