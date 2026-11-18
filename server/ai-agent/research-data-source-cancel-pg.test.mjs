import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';
import {loadFixtureInput} from '../../../app/server/scripts/wp01/local-config.mjs';import {withFixtureTransaction} from '../../../app/server/scripts/wp01/fixture-guard.mjs';import {createLocalMaterialAccess} from '../../scripts/local-session-materials.mjs';import {createResearchDataStaging} from './research-data-staging.mjs';import * as imports from './research-data-imports.mjs';
const root='/Users/mac/aisciencesys/',{ids}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8')),manifest=JSON.parse(readFileSync(new URL('../../.tmp/ai-file-data-2026-11-12/p05-browser-visits-1794557573418/result.json',import.meta.url),'utf8')),{env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const require=createRequire(root+'app/server/package.json');require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});const load=(p,k)=>require(root+'app/server/src/'+p+'.ts')[k],rollback=Symbol('rollback');
test('cancelling a source is blocked in the same real authorized transaction when its import committed; original P04 receipt stays current',async()=>{
 await assert.rejects(withFixtureTransaction(env,'app',async tx=>{
  const user={tenantId:ids.tenant,accountId:ids.owner,studyGroupId:ids.group,researchProjectId:ids.project,authVersion:5,role:'researcher',isTenantAdmin:false},sid=manifest.actors.owner.sessionId,pid=manifest.actors.owner.preflight.id;
  const nativeAccess=createLocalMaterialAccess({env,ids,load}),access={transaction:(u,s,fn)=>nativeAccess.inTransaction(tx,u,s,fn)},service=createResearchDataStaging({access,storage:{},engine:{},assertCancellation:(...args)=>imports.assertSourcePreflightCancellableInTx(...args)});
  await nativeAccess.inTransaction(tx,user,sid,async()=>{});const [before]=await tx.$queryRawUnsafe('SELECT state,version,preview_hash FROM rh_ai.research_data_preflights WHERE id=$1',pid);assert.equal(before.state,'previewed');
  await assert.rejects(service.cancel(user,sid,pid,{version:before.version}),e=>e.code==='DATA_ALREADY_IMPORTED');const [after]=await tx.$queryRawUnsafe('SELECT state,version,preview_hash FROM rh_ai.research_data_preflights WHERE id=$1',pid);assert.deepEqual(after,before);
  // No source change at all when a planned import is still unresolved either.
  const unknownTx={$queryRawUnsafe:async()=>[{state:'planned'}]};await assert.rejects(imports.assertSourcePreflightCancellableInTx(unknownTx,user,sid,'source'),e=>e.code==='DATA_IMPORT_PENDING');
  throw rollback;
 }),e=>e===rollback);
});
