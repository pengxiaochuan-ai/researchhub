// Metadata-only baselines on the approved synthetic DB. Never initialize old grants.
import assert from 'node:assert/strict';
import{readFileSync,writeFileSync,mkdirSync,existsSync}from'node:fs';
import{createHash}from'node:crypto';
import{execFileSync}from'node:child_process';
import{assertCrfApprovedLedger,readCrfCallExtension}from'./synthetic-crf-methods-ai-approval.mjs';
import{loadFixtureInput}from'../../app/server/scripts/wp01/local-config.mjs';
import{assertFixtureTarget,withFixtureTransaction}from'../../app/server/scripts/wp01/fixture-guard.mjs';
const root='/Users/mac/aisciencesys/',mode=process.argv[2];assert(['baseline','verify'].includes(mode));
const dir=root+'.tmp/researchhub-wp07-crf-methods/',file=dir+'preservation.json',sha=b=>createHash('sha256').update(b).digest('hex');
const {ids}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
await assertFixtureTarget(env);
const old=JSON.parse(readFileSync(root+'.tmp/researchhub-wp06-synthetic-edc/preservation.json'));
const sources=old.sources.map(s=>({path:s.path,sha256:sha(readFileSync(root+s.path))}));assert.deepEqual(sources,old.sources,'OLD_SOURCE_CHANGED');
const processes=execFileSync('ps',['-p','719,722,729,737,57090,70526,70537,70542','-o','pid=,lstart=,command='],{encoding:'utf8'});assert.equal(processes,old.processes,'OLD_PROCESS_CHANGED');
const rows={};for(const table of Object.keys(old.rows)){assert.match(table,/^[a-z_]+$/);rows[table]=await withFixtureTransaction(env,'direct',tx=>tx.$queryRawUnsafe(`SELECT id,md5(row_to_json(t)::text) AS digest FROM public."${table}" t ORDER BY id`),{readOnly:true});}
const authorization=await withFixtureTransaction(env,'direct',async tx=>{
 const feature=await tx.tenantFeatureEntitlement.findFirst({where:{tenantId:ids.tenant,featureKey:'research_methods_worker',enabled:true}}),skill=await tx.skill.findFirst({where:{id:ids.tenant+'-synthetic-dq',tenantId:ids.tenant,key:'research-data-quality',version:1,status:'published'}}),role=await tx.permissionRole.findUnique({where:{id:ids.role}});
 assert(feature&&skill&&role&&['artifact.read','artifact.edit','artifact.create','chat.use'].every(p=>role.buttonPermissions.includes(p)));
 assert.equal(skill.backend?.executorKey,'research-data-quality');assert.equal(skill.backend?.operatorVersion,'t19-1');assert.equal(skill.rules?.llm_forbidden,true);
 const grants=[];for(const actor of ['owner','admin']){const grant=await tx.skillAssignment.findFirst({where:{tenantId:ids.tenant,skillId:skill.id,agentId:ids.tenant+'-kb-research',accountId:ids[actor],scopeKey:ids[actor],enabled:true}}),member=await tx.researchProjectMembership.findFirst({where:{tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:ids[actor],status:'active'}});assert(grant&&member);grants.push({actor,grant,member});}
 return{featureHash:sha(JSON.stringify(feature)),skillHash:sha(JSON.stringify(skill)),roleHash:sha(JSON.stringify(role)),grantsHash:sha(JSON.stringify(grants))};
},{readOnly:true});
const ledger=readFileSync(root+'.tmp/researchhub-knowledge-local/ai-budget-20261022.json'),budget=JSON.parse(ledger),approvalFile=root+'.tmp/researchhub-knowledge-local/wp07-ai-approval-20261025.json';assert.equal(budget.limitMicroCny,5_000_000);
let originalLedger=ledger;if(existsSync(approvalFile)){const receipt=JSON.parse(readFileSync(approvalFile));assertCrfApprovedLedger(budget,receipt,readCrfCallExtension(root+'.tmp/researchhub-knowledge-local/wp07-ai-call-extension-20261026.json'));originalLedger=Buffer.from(receipt.originalLedgerText);}assert.equal(JSON.parse(originalLedger).records.length,75,'UNEXPECTED_PRIOR_LEDGER');
const value={sources,processes,rows,authorization,schemaHash:sha(readFileSync(root+'app/server/prisma/schema.prisma')),ledgerHash:sha(originalLedger),idsHash:sha(JSON.stringify(ids))};
if(mode==='baseline'){assert(!existsSync(file),'BASELINE_ALREADY_EXISTS');mkdirSync(dir,{recursive:true,mode:0o700});writeFileSync(file,JSON.stringify(value),{mode:0o600,flag:'wx'});}
else{const prior=JSON.parse(readFileSync(file));assert.deepEqual({...value,rows:undefined},{...prior,rows:undefined});for(const[table,entries]of Object.entries(prior.rows)){const now=new Map(rows[table].map(x=>[x.id,x.digest]));for(const x of entries)assert.equal(now.get(x.id),x.digest,'HISTORICAL_ROW_CHANGED:'+table);}}
console.log(JSON.stringify({passed:true,mode,oldSources:sources.length,protectedTables:Object.keys(rows).length,protectedHistoricalRows:Object.values(mode==='verify'?JSON.parse(readFileSync(file)).rows:rows).reduce((n,a)=>n+a.length,0),ledgerRecords:budget.records.length,originalLedgerRecords:75,originalLedgerPrefixPreserved:true,ledgerUnchanged:sha(ledger)===sha(originalLedger),existingAuthorizationSufficient:true,dbWrites:0,modelCalls:0}));
