// Read-only paired comparison of the exact old/new per-row history projection.
import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {createHash} from 'node:crypto';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';import {assertFixtureTarget} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {hubHistoryQuery,projectHubHistory,projectHubHistoryPage} from './hub-conversation-history.mjs';
assert.deepEqual(process.argv.slice(2),['--synthetic-staging','--read-only']);
const root=new URL('../../',import.meta.url).pathname,{env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
process.env.DATABASE_URL=env.WP01_TEST_DATABASE_URL;process.env.DIRECT_URL=env.WP01_TEST_DIRECT_URL;
const require=createRequire(root+'app/server/package.json');require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});const {PrismaService}=require(root+'app/server/src/prisma/prisma.service.ts'),prisma=new PrismaService();
const {ids,key}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));assert.equal(key,'rh-kb-local-b0e2af9d');const results=[];
try{for(const actor of ['owner','admin']){
 const user={tenantId:ids.tenant,accountId:ids[actor],studyGroupId:ids.group,researchProjectId:ids.project},native=prisma.forTenant(ids.tenant,ids.group,ids.project),rows=await native.session.findMany(hubHistoryQuery(user,ids.tenant+'-kb-research'));const runs=[];
 for(let iteration=0;iteration<3;iteration++)for(const mode of iteration%2?['new','old']:['old','new']){
  let jobs=0;const db={knowledgeChatJob:{findFirst:args=>{jobs++;return native.knowledgeChatJob.findFirst(args);}}},start=performance.now();
  const items=mode==='new'?await projectHubHistoryPage(rows,user,db,20):await Promise.all(rows.slice(0,20).map(async s=>projectHubHistory(s,await db.knowledgeChatJob.findFirst({where:{...user,sessionId:s.id},orderBy:[{createdAt:'desc'},{id:'desc'}],select:{requestKey:true,payload:true}}))));
  runs.push({mode,jobs,milliseconds:Math.round((performance.now()-start)*100)/100,dtoSha256:createHash('sha256').update(JSON.stringify(items)).digest('hex')});
 }
 assert.equal(new Set(runs.map(x=>x.dtoSha256)).size,1);const sample=await projectHubHistoryPage(rows,user,{knowledgeChatJob:{findFirst:args=>native.knowledgeChatJob.findFirst(args)}},20),articles=sample.filter(x=>x.kind==='article').length;
 assert(runs.filter(x=>x.mode==='new').every(x=>x.jobs===articles));results.push({actor,items:sample.length,articles,runs});
}}finally{await prisma.onModuleDestroy();}
const out=root+'researchhub/.tmp/ai-resumable-2026-11-16/';mkdirSync(out,{recursive:true});writeFileSync(out+'history-benchmark.json',JSON.stringify({scope:'Read-only internal projection benchmark; excludes endpoint authorization and browser rendering',at:new Date().toISOString(),results},null,2)+'\n');console.log(JSON.stringify({passed:true,actors:results.length,evidence:out+'history-benchmark.json'}));
