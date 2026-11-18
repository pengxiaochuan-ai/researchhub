// Read-only dedicated synthetic baseline. Never scans/claims tasks or changes authorization.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {relative} from 'node:path';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
const root='/Users/mac/aisciencesys/',file=root+'researchhub/.superpowers/sdd/wp05-execution-preparation-20261023/preservation.json';
const initial=process.argv[2]==='baseline',authorizedAi=process.argv[2]==='verify-authorized-ai';assert(initial||authorizedAi||process.argv[2]==='verify');if(initial)assert(!existsSync(file));
const previous=JSON.parse(readFileSync(root+'researchhub/.superpowers/sdd/wp05-design-20261023/preservation.json')),old=initial?null:JSON.parse(readFileSync(file));
const sha=b=>createHash('sha256').update(b).digest('hex');
const sources=previous.sources.map(s=>({path:s.path,sha256:sha(readFileSync(root+s.path))}));assert.deepEqual(sources,previous.sources);
const schemaSha=sha(readFileSync(root+'app/server/prisma/schema.prisma')),ledgerSha=sha(readFileSync(root+'.tmp/researchhub-knowledge-local/ai-budget-20261022.json'));
const processes=execFileSync('ps',['-p','719,722,729,737,57090,70526,70537,70542','-o','pid=,lstart=,command='],{encoding:'utf8'});assert.equal(processes,previous.oldProcesses);
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json'),runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const require=createRequire(root+'app/server/package.json');const prismaModel=new Map([...readFileSync(root+'app/server/prisma/schema.prisma','utf8').matchAll(/model (\w+) \{([\s\S]*?)\n\}/g)].map(m=>[m[1],m[2].match(/@@map\("([a-z_]+)"\)/)?.[1]]));
const formal=['StudyProtocolVersion','VisitPlan','FormTemplate','FormVersion','FormAssignment','FormResponse','Subject','SubjectVisit','ScaleResult'].map(m=>prismaModel.get(m));assert(formal.every(n=>typeof n==='string'));
const rows={},formalRows={};
for(const table of new Set([...Object.keys(previous.rows),...formal])){
 assert.match(table,/^[a-z_]+$/);const current=await withFixtureTransaction(env,'direct',tx=>tx.$queryRawUnsafe(`SELECT id,md5(row_to_json(t)::text) AS digest FROM public."${table}" t ORDER BY id`),{readOnly:true});
 rows[table]=current;if(formal.includes(table))formalRows[table]=current;
}
const auth=await withFixtureTransaction(env,'direct',async tx=>{const role=await tx.permissionRole.findUnique({where:{id:runtime.ids.role}}),agentId=runtime.ids.tenant+'-kb-research',agent=await tx.agent.findUnique({where:{id:agentId}}),grants=await tx.agentAccess.findMany({where:{tenantId:runtime.ids.tenant,agentId}});assert.equal(role.tenantId,runtime.ids.tenant);assert(['artifact.read','artifact.create','artifact.edit','chat.use'].every(p=>role.buttonPermissions.includes(p)));assert(['artifacts','knowledge','workbench'].every(p=>role.menuPermissions.includes(p)));assert(agent&&[runtime.ids.owner,runtime.ids.admin].every(id=>grants.some(g=>g.accountId===id)));return{roleHash:sha(JSON.stringify(role)),agentHash:sha(JSON.stringify(agent)),grantHash:sha(JSON.stringify(grants.sort((a,b)=>a.id.localeCompare(b.id))))};},{readOnly:true});
const evidence=root+'docs/test/evidence/2026-10-23-researchhub-wp05-design/',manifest=JSON.parse(readFileSync(evidence+'final-manifest.json'));
function verifyTree(dir){const {readdirSync}=require('node:fs');return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?verifyTree(dir+'/'+e.name):[dir+'/'+e.name]);}
for(const d of manifest.evidenceDirectories){const dir=evidence+d.directory+'/',files=verifyTree(dir).sort();assert.equal(files.length,d.files);const entries=files.map(p=>[relative(dir,p),sha(readFileSync(p))]);assert.equal(sha(JSON.stringify(entries)),d.sha256OfSortedPathAndHashJson,d.directory);}
const snapshot={sources,schemaSha,ledgerSha,processes,rows,formalRows,auth,oldEvidenceManifestSha:sha(readFileSync(evidence+'final-manifest.json'))};
if(old){assert.deepEqual({...snapshot,rows:undefined,...(authorizedAi?{ledgerSha:undefined}:{})},{...old,rows:undefined,...(authorizedAi?{ledgerSha:undefined}:{})});if(authorizedAi){const ledger=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/ai-budget-20261022.json'));assert.equal(ledger.limitMicroCny,5000000);assert.equal(ledger.priceValidUntil,'2026-10-24T10:03:30.000Z');assert.equal(sha(JSON.stringify(ledger.records.slice(0,52))),'b414a39d945462af36002f73460d47a59b58e54defdf903b23ec3c6e7579224e');assert(ledger.records.every(r=>r.status==='known'));assert(ledger.records.reduce((n,r)=>n+r.costMicroCny,0)<=5000000);}for(const[table,prior]of Object.entries(old.rows)){const current=new Map(rows[table].map(r=>[r.id,r.digest]));for(const r of prior)assert.equal(current.get(r.id),r.digest,'Historical synthetic row changed: '+table);}}
if(initial)writeFileSync(file,JSON.stringify(snapshot),{flag:'wx',mode:0o600});
console.log(JSON.stringify({passed:true,baseline:initial,oldSources:sources.length,protectedTables:Object.keys(rows).length,protectedRows:Object.values(old?.rows??rows).reduce((n,a)=>n+a.length,0),formalTables:formal.length,formalRows:Object.values(formalRows).reduce((n,a)=>n+a.length,0),oldServicesUnchanged:true,ledgerUnchanged:!authorizedAi,original52RecordsPreserved:authorizedAi,authorizedAiOnly:authorizedAi,originalAuthorizationSufficient:true,frozenEvidenceDirectories:manifest.evidenceDirectories.length}));
