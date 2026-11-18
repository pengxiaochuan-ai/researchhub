import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {openGeneralUnitHarness,configFile,json,root} from '../../scripts/ai-general-unit-runtime.mjs';import {createLocalResearchDataImports} from '../../scripts/local-research-data-imports.mjs';
import {assertGeneralUnitManifest} from '../../scripts/ai-research-data-general-scope.mjs';
test('actual local facade keeps old P05 and new unit sources disjoint with no new writes',async()=>{
 const h=await openGeneralUnitHarness(),unit=json(configFile),old=json(root+'researchhub/.tmp/ai-file-data-2026-11-12/p05-authorized-scope.json'),api=createLocalResearchDataImports({...h,storage:{getBuffer:()=>{throw Error('NO_FILE_READ_EXPECTED');}}});
 for(const actor of ['owner','admin']){
  const user={tenantId:h.ids.tenant,accountId:h.ids[actor],authVersion:5,role:actor==='owner'?'researcher':'tenant_admin',isTenantAdmin:actor==='admin',studyGroupId:h.ids.group,researchProjectId:h.ids.project};
  assert.deepEqual((await api.service.targets(user,unit.sessions[user.accountId])).items.map(x=>x.id),[unit.target.studyId]);
  assert.deepEqual((await api.service.targets(user,old.sessions[user.accountId])).items.map(x=>x.id),[old.target.studyId]);
  assert.deepEqual((await api.service.targets(user,unit.sessions[h.ids[actor==='owner'?'admin':'owner']])).items,[]);
  await assert.rejects(async()=>api.service.prepare(user,unit.sessions[user.accountId],{requestKey:'unit-cannot-route-old',studyId:old.target.studyId,preflightId:'none',preflightVersion:1}),e=>e.status===403);
 }
});
test('config boundary is isolated: fresh targets inject a file fault, accepted targets check the registry read-only',async t=>{
 const h=await openGeneralUnitHarness(),original=readFileSync(configFile),c=JSON.parse(original),old=json(root+'researchhub/.tmp/ai-file-data-2026-11-12/p05-authorized-scope.json'),user={tenantId:h.ids.tenant,accountId:h.ids.admin,authVersion:5,role:'tenant_admin',isTenantAdmin:true,studyGroupId:h.ids.group,researchProjectId:h.ids.project},args={...h,storage:{getBuffer:()=>{throw Error('UNEXPECTED_FILE_READ');}}},api=createLocalResearchDataImports(args);
 const accepted=await h.read(tx=>tx.formResponse.count({where:{tenantId:h.ids.tenant,researchProjectId:c.target.executionProjectId}}));
 if(accepted){assert.equal(accepted,4);const [m]=await h.read(tx=>tx.$queryRawUnsafe('SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=$1','rh-general-unit-20261113'));assertGeneralUnitManifest(c,m.manifest);const drift=structuredClone(c);drift.target.studyId=old.target.studyId;assert.throws(()=>assertGeneralUnitManifest(drift,m.manifest));t.diagnostic('Accepted fixture protected: no local file mutation; full file fault was proved before live acceptance.');return;}
 try{
  writeFileSync(configFile,'{',{mode:0o600});assert.deepEqual((await api.service.targets(user,old.sessions[user.accountId])).items.map(x=>x.id),[old.target.studyId]);await assert.rejects(api.service.targets(user,c.sessions[user.accountId]));
  const restarted=createLocalResearchDataImports(args);assert.deepEqual((await restarted.service.targets(user,old.sessions[user.accountId])).items.map(x=>x.id),[old.target.studyId]);await assert.rejects(restarted.service.targets(user,c.sessions[user.accountId]));
  const drift=structuredClone(c);drift.target.studyId=old.target.studyId;drift.target.executionProjectId=old.target.executionProjectId;writeFileSync(configFile,JSON.stringify(drift),{mode:0o600});
  const drifted=createLocalResearchDataImports(args);await assert.rejects(drifted.service.targets(user,c.sessions[user.accountId]),e=>e.status===403);
 }finally{writeFileSync(configFile,original,{mode:0o600});}
 assert.deepEqual(readFileSync(configFile),original);
});
