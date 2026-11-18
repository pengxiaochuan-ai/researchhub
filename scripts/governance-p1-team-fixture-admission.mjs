// One-shot admission BEFORE the approved fixture exists. All probe writes roll back.
// Catches denying the newly approved object and permitting a second extra object.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {directoryRollback} from '../server/directory/test-support.mjs';
import {createDirectoryService} from '../server/directory/commands.mjs';
import {localDirectoryBudget} from '../server/directory/controller.mjs';
const out=new URL('../docs/testing/evidence/governance-p1-team-write-2026-11-12/admission-'+Date.now()+'/',import.meta.url);
mkdirSync(out,{recursive:true});const result={checks:[],persistentWrites:0};
try{
 await directoryRollback(async({db,direct,ctx})=>{
  const service=createDirectoryService({db:{...db,budget:localDirectoryBudget}}),actor=ctx('admin');
  for(const [kind,baseline] of [['team',3],['organization',3],['researcher',4]]){
   const count=async()=>{const [r]=await direct(tx=>tx.$queryRaw`SELECT count(*)::int AS n FROM rh_directory.entity WHERE tenant_id=${db.tenantId} AND kind=${kind}`);return r.n;};
   assert.equal(await count(),baseline,'Stop: fixture counts changed; never replace existing objects');
   const made=await service.createEntity(actor,{kind,stableKey:'p1-admission-'+kind+'-'+randomUUID(),requestKey:randomUUID()});
   assert(made.id);assert.equal(await count(),baseline+1);
   await assert.rejects(()=>service.createEntity(actor,{kind,stableKey:'p1-over-boundary-'+randomUUID(),requestKey:randomUUID()}),{code:'DIRECTORY_FIXTURE_BUDGET',status:409});
   assert.equal(await count(),baseline+1);
   result.checks.push(kind+': exactly one additional object permitted; second refused with409');
  }
 });result.passed=true;
}catch(e){result.passed=false;result.code=e.code;result.failure=e.message;process.exitCode=1;}
writeFileSync(new URL('result.json',out),JSON.stringify(result,null,2));console.log(JSON.stringify({...result,evidence:out.pathname}));
