import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {hubHistoryQuery,projectHubHistory} from './hub-conversation-history.mjs';
const {env}=loadFixtureInput('../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const {ids}=JSON.parse(readFileSync('../.tmp/researchhub-knowledge-local/runtime.json'));
test('real synthetic PG history query isolates both existing accounts, Study and tenant; no writes',async()=>{
 assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
 await withFixtureTransaction(env,'direct',async db=>{
  for(const actor of ['admin','owner']){
   const user={tenantId:ids.tenant,accountId:ids[actor],studyGroupId:ids.group,researchProjectId:ids.project};
   const rows=await db.session.findMany(hubHistoryQuery(user,ids.tenant+'-kb-research',{limit:50}));assert(rows.length>0);
   for(const s of rows){const actual=await db.session.findUnique({where:{id:s.id},select:{tenantId:true,accountId:true,studyGroupId:true,researchProjectId:true,deletedAt:true}});assert.deepEqual(actual,{...user,deletedAt:null});assert(['hub','article'].includes(projectHubHistory(s).kind));}
   for(const other of [{accountId:'nonexistent-account'},{studyGroupId:'other-study'},{tenantId:'other-tenant'},{researchProjectId:'other-project'}])assert.equal((await db.session.findMany(hubHistoryQuery({...user,...other},ids.tenant+'-kb-research'))).length,0);
   const page1=await db.session.findMany(hubHistoryQuery(user,ids.tenant+'-kb-research',{limit:1,page:1})),page2=await db.session.findMany(hubHistoryQuery(user,ids.tenant+'-kb-research',{limit:1,page:2}));assert.equal(page1[1]?.id,page2[0]?.id);
  }
 },{readOnly:true});
});
