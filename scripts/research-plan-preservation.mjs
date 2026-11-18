// Read-only, fixture-guarded preservation check. Never prints private configuration.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),dir=root+'.tmp/researchhub-knowledge-local/',out=root+'docs/test/evidence/2026-10-22-researchhub-research-plan/';
const baseline=JSON.parse(readFileSync(out+'baseline.json')),runtime=JSON.parse(readFileSync(dir+'runtime.json')),ledger=JSON.parse(readFileSync(dir+'ai-budget-20261022.json'));
const sha=b=>createHash('sha256').update(b).digest('hex'),save=(n,v)=>writeFileSync(out+n,JSON.stringify(v,null,2));
for(const f of baseline.source)assert.equal(sha(readFileSync(root+f.path)),f.sha256,'OLD_SOURCE_CHANGED:'+f.path);
assert.equal(execFileSync('ps',['-p','719,722,729,737,57090,70526,70537,70542','-o','pid=,lstart=,command='],{encoding:'utf8'}),baseline.oldProcesses);
assert.deepEqual(ledger.records.slice(0,baseline.ledger.records.length),baseline.ledger.records);assert.equal(ledger.limitMicroCny,baseline.ledger.limitMicroCny);assert.equal(ledger.priceValidUntil,baseline.ledger.priceValidUntil);assert.ok(ledger.records.every(r=>r.status==='known'));
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const history={},tables=['processing_task','knowledge_import_task','knowledge_chat_job','research_agent_run','research_agent_stage_attempt','research_artifact_export_job','modality_file','knowledge_doc','research_artifact_file'];
for(const table of tables){history[table]=await withFixtureTransaction(env,'direct',tx=>tx.$queryRawUnsafe(`SELECT count(*)::int AS count,md5(coalesce(string_agg(md5(row_to_json(t)::text),'' ORDER BY id),'')) AS digest FROM "${table}" t WHERE "tenantId" IS DISTINCT FROM $1`,runtime.ids.tenant),{readOnly:true});assert.deepEqual(history[table],baseline.history[table],'OTHER_HISTORY_CHANGED:'+table);}
const access=await withFixtureTransaction(env,'direct',async tx=>({members:await tx.studyGroupMembership.findMany({where:{tenantId:runtime.ids.tenant,studyGroupId:runtime.ids.group,roleId:runtime.ids.role},select:{accountId:true}}),role:await tx.permissionRole.findUnique({where:{id:runtime.ids.role},select:{menuPermissions:true,buttonPermissions:true}}),pendingOwnJobs:await tx.knowledgeChatJob.count({where:{tenantId:runtime.ids.tenant,status:{in:['queued','processing']}}})}),{readOnly:true});
assert.deepEqual(access.members.map(x=>x.accountId).sort(),[runtime.ids.owner,runtime.ids.admin].sort());assert.ok(['artifact.read','artifact.create','artifact.edit'].every(k=>access.role.buttonPermissions.includes(k)));assert.ok(!access.role.buttonPermissions.some(k=>/^artifact\./.test(k)&&!['artifact.read','artifact.create','artifact.edit'].includes(k)));assert.equal(access.pendingOwnJobs,0);
const frozen=[];for(const name of ['2026-10-22-researchhub-development-admission','2026-10-22-researchhub-service-reuse','2026-10-22-researchhub-knowledge-frontend','2026-10-22-researchhub-local-knowledge-runtime','2026-10-22-researchhub-knowledge-ai']){
 const p=root+'docs/test/evidence/'+name+'/';let m;try{m=JSON.parse(readFileSync(p+'manifest.json'));}catch{continue;}const entries=m.entries??m.files;assert.ok(Array.isArray(entries));for(const e of entries){const f=e.path.startsWith('docs/test/evidence/')?root+e.path:p+e.path;assert.equal(sha(readFileSync(f)),e.sha256,'FROZEN_CHANGED:'+name+'/'+e.path);}frozen.push({name,entries:entries.length});
}
mkdirSync(out+'provider-traces',{recursive:true});const newRecords=ledger.records.slice(baseline.ledger.records.length),jobs=new Set();for(const r of newRecords){const content=readFileSync(dir+'ai-traces/'+r.id+'.json'),trace=JSON.parse(content);jobs.add(trace.jobId);writeFileSync(out+'provider-traces/'+r.id+'.json',content);}
for(const name of readdirSync(dir+'ai-traces/').filter(n=>n.endsWith('-runtime.json')))if(jobs.has(name.slice(0,-13)))writeFileSync(out+'provider-traces/'+name,readFileSync(dir+'ai-traces/'+name));
const secrets=[runtime.password,runtime.secret,...readFileSync(root+'app/server/.env','utf8').split(/\r?\n/).filter(s=>/^\s*DEEPSEEK_API_KEY\s*=/.test(s)).map(s=>s.slice(s.indexOf('=')+1).trim().replace(/^["']|["']$/g,''))];
function scan(p){for(const e of readdirSync(p,{withFileTypes:true})){const f=p+'/'+e.name;if(e.isDirectory())scan(f);else{const bytes=readFileSync(f);for(const secret of secrets)assert.ok(!bytes.includes(Buffer.from(secret)),'PRIVATE_VALUE_IN_EVIDENCE');}}}scan(out);
save('preservation.json',{passed:true,at:new Date().toISOString(),oldSourceFiles:baseline.source.length,oldProcessesUnchanged:8,history,frozen,access,ledger:{calls:ledger.records.length,newCalls:newRecords.length,allKnown:true,spentMicroCny:ledger.records.reduce((n,r)=>n+r.costMicroCny,0),limitMicroCny:ledger.limitMicroCny,priceValidUntil:ledger.priceValidUntil,baselinePreserved:true},privateValueScanPassed:true,runtimePid:runtime.pid});
console.log(JSON.stringify({passed:true,oldSourceFiles:baseline.source.length,otherHistoryTables:tables.length,frozen,calls:ledger.records.length,costMicroCny:ledger.records.reduce((n,r)=>n+r.costMicroCny,0)}));
