// Dedicated synthetic DB metadata only. No claim/recovery, role mutation or model call.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction,assertFixtureTarget} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {assertApprovedEdcLedger} from './synthetic-edc-ai-approval.mjs';

const root='/Users/mac/aisciencesys/',dir=root+'.tmp/researchhub-wp06-synthetic-edc/',mode=process.argv[2];
assert(['baseline','verify','verify-approved-ai'].includes(mode));mkdirSync(dir,{recursive:true,mode:0o700});
const baselineFile=dir+'preservation.json',sha=v=>createHash('sha256').update(v).digest('hex');
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
await assertFixtureTarget(env);
const old=JSON.parse(readFileSync(root+'researchhub/.superpowers/sdd/wp05-execution-preparation-20261023/preservation.json'));
const sources=old.sources.map(s=>({path:s.path,sha256:sha(readFileSync(root+s.path))}));assert.deepEqual(sources,old.sources,'OLD_SOURCE_CHANGED');
const processes=execFileSync('ps',['-p','719,722,729,737,57090,70526,70537,70542','-o','pid=,lstart=,command='],{encoding:'utf8'});
assert.equal(processes,old.processes,'OLD_SERVICE_IDENTITY_CHANGED');
const rows={};for(const table of Object.keys(old.rows)){
 assert.match(table,/^[a-z_]+$/);rows[table]=await withFixtureTransaction(env,'direct',tx=>tx.$queryRawUnsafe(`SELECT id,md5(row_to_json(t)::text) AS digest FROM public."${table}" t ORDER BY id`),{readOnly:true});
}
const ids=runtime.ids;
const authorization=await withFixtureTransaction(env,'direct',async tx=>{
 const role=await tx.permissionRole.findUnique({where:{id:ids.role}}),agentId=ids.tenant+'-kb-research',grants=await tx.agentAccess.findMany({where:{tenantId:ids.tenant,agentId},orderBy:{id:'asc'}});
 assert.equal(role.tenantId,ids.tenant);assert(['artifact.read','artifact.create','artifact.edit','chat.use'].every(k=>role.buttonPermissions.includes(k)));
 for(const name of ['owner','admin']){const account=await tx.account.findUnique({where:{id:ids[name]}}),member=await tx.researchProjectMembership.findFirst({where:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:ids[name],status:'active'}});assert(account?.status==='active'&&account.tenantId===ids.tenant&&member&&grants.some(g=>g.accountId===account.id));}
 return{roleHash:sha(JSON.stringify(role)),agentAccessHash:sha(JSON.stringify(grants))};
},{readOnly:true});
const require=createRequire(root+'app/server/package.json');require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});
const {ResearchArtifactsService}=require(root+'app/server/src/research-artifacts/research-artifacts.service.ts');
for(const name of ['createWithSourcesInTx','createVersion'])assert.equal(typeof ResearchArtifactsService.prototype[name],'function');
const ledgerFile=root+'.tmp/researchhub-knowledge-local/ai-budget-20261022.json',ledger=JSON.parse(readFileSync(ledgerFile));assert.equal(ledger.limitMicroCny,5000000);
const current={sources,processes,rows,authorization,schemaHash:sha(readFileSync(root+'app/server/prisma/schema.prisma')),ledgerHash:sha(readFileSync(ledgerFile)),idsHash:sha(JSON.stringify(ids))};
if(mode==='baseline'){
 assert(!existsSync(baselineFile),'BASELINE_ALREADY_EXISTS');writeFileSync(baselineFile,JSON.stringify(current),{flag:'wx',mode:0o600});
 const file=root+'.tmp/researchhub-knowledge-local/wp06-scope.json';assert(!existsSync(file),'SCOPE_ALREADY_EXISTS');
 writeFileSync(file,JSON.stringify({schema:'rh-synthetic-edc-scope.v1',enabled:true,approval:'2026-10-25-user-WP06-M01-M02-M03',tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accounts:[ids.owner,ids.admin],prefix:'rh-edc-20261023:',marker:'rh-synthetic-edc.v1',operations:['capture','explain','report'],paidAiApproved:false},null,2),{flag:'wx',mode:0o600});
}else{
 const prior=JSON.parse(readFileSync(baselineFile));
 if(mode==='verify-approved-ai'){const receipt=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/wp06-ai-approval-20261025.json'));assert.equal(receipt.originalLedgerHash,prior.ledgerHash);assertApprovedEdcLedger(ledger,receipt);assert.deepEqual({...current,rows:undefined,ledgerHash:undefined},{...prior,rows:undefined,ledgerHash:undefined});}
 else assert.deepEqual({...current,rows:undefined},{...prior,rows:undefined});
 for(const[table,entries]of Object.entries(prior.rows)){const now=new Map(rows[table].map(r=>[r.id,r.digest]));for(const r of entries)assert.equal(now.get(r.id),r.digest,'HISTORICAL_ROW_CHANGED:'+table);}
 for(const[table,entries]of Object.entries(old.formalRows))assert.deepEqual(rows[table],entries,'FORMAL_TABLE_CHANGED:'+table);
}
console.log(JSON.stringify({passed:true,mode,oldSources:sources.length,protectedTables:Object.keys(rows).length,protectedHistoricalRows:Object.values(mode!=='baseline'?JSON.parse(readFileSync(baselineFile)).rows:rows).reduce((n,a)=>n+a.length,0),observedRowsIncludingNewPackets:Object.values(rows).reduce((n,a)=>n+a.length,0),currentAuthorizationSufficient:true,oldProcessesUnchanged:true,ledgerRecords:ledger.records.length,ledgerUnchanged:mode==='verify',originalLedgerPrefixPreserved:mode==='verify-approved-ai',paidAiApproved:mode==='verify-approved-ai',roleChanges:0}));
