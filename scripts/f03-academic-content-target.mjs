// Explicit single use of the guarded standing synthetic target. No credentials printed.
import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';
import {target} from './f01-admission-migration.mjs';import {protectedAcademicSnapshot} from './f03-academic-content-migration.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';import {verifyAcademicBrowser} from './f03-academic-content-browser.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
export async function verifyTarget({existingReport}={}){
 const {env,ids}=target();await assertFixtureTarget(env);const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json')),manifest=JSON.parse(readFileSync(root+'researchhub/.tmp/f03/migration-manifest.json'));
 const before=existingReport?manifest.protected:await withFixtureTransaction(env,'direct',async tx=>{const rows=await tx.$queryRawUnsafe('SELECT id FROM rh_academic.content');assert.equal(rows.length,0,'F03_TARGET_ALREADY_HAS_RECORDS_DO_NOT_RERUN');return protectedAcademicSnapshot(tx);},{readOnly:true});assert.deepEqual(before,manifest.protected,'F03_PRE_BROWSER_ORIGINAL_STATE_CHANGED');
 const report=existingReport?JSON.parse(readFileSync(existingReport)):await verifyAcademicBrowser({base:'http://127.0.0.1:19501',tenantSlug:ids.tenant,password:runtime.password});assert.equal(report.passed,true);
 const proof=await withFixtureTransaction(env,'direct',async tx=>{
  const records=await tx.$queryRawUnsafe('SELECT id,revision,status,published_version_id,first_published_at FROM rh_academic.content ORDER BY id');assert.equal(records.length,3);assert.deepEqual(records.map(x=>x.id).sort(),report.records.map(x=>x.id).sort());
  const versionCount=Number((await tx.$queryRawUnsafe('SELECT count(*) AS n FROM rh_academic.version'))[0].n),eventCount=Number((await tx.$queryRawUnsafe('SELECT count(*) AS n FROM rh_academic.event'))[0].n);assert(versionCount<=12&&eventCount<=36);
  const loginAudits=await tx.auditLog.findMany({where:{createdAt:{gte:new Date(manifest.at)},action:'login',accountId:{in:[ids.admin,ids.owner]},target:{in:['admin@example.org','owner@example.org']}},select:{id:true,action:true,target:true,createdAt:true}});
  assert.deepEqual(await protectedAcademicSnapshot(tx,{contentIds:records.map(x=>x.id),allowedAuditIds:loginAudits.map(x=>x.id)}),before,'F03_ORIGINAL_TABLE_CHANGED');return{records,versionCount,eventCount,protectedTables:before.length,originalRowsUnchanged:true,expectedLoginAudits:loginAudits,pid:runtime.pid,syntheticOnly:true,at:new Date().toISOString()};
 },{readOnly:true});writeFileSync(root+'researchhub/.tmp/f03/target-result.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));return proof;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){assert(['--run','--finalize'].includes(process.argv[2]));verifyTarget({existingReport:process.argv[2]==='--finalize'?process.argv[3]:undefined}).catch(e=>{console.error(e.code??e.message);process.exitCode=1;});}
