// Guarded, append-only synthetic test baseline. Never reads the clinical database.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadFixtureInput } from '../../app/server/scripts/wp01/local-config.mjs';
import { withFixtureTransaction } from '../../app/server/scripts/wp01/fixture-guard.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url)),out=root+'docs/test/evidence/2026-10-22-researchhub-research-flow-e2e/';
mkdirSync(out,{recursive:true});
const previous=JSON.parse(readFileSync(root+'docs/test/evidence/2026-10-22-researchhub-synthetic-asset/preservation.json'));
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const readTx=fn=>withFixtureTransaction(env,'direct',fn,{readOnly:true});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const baselineMode=process.argv[2]==='baseline';
const baseline=baselineMode?null:JSON.parse(readFileSync(out+'baseline.json'));
const protectedTables=[...Object.keys(previous.history),'research_artifact','research_artifact_version','research_artifact_source'];
const history={},own={};
for(const table of protectedTables){
  assert.match(table,/^[a-z_]+$/);
  history[table]=await readTx(tx=>tx.$queryRawUnsafe(`SELECT count(*)::int AS count,md5(coalesce(string_agg(md5(row_to_json(t)::text),'' ORDER BY id),'')) AS digest FROM "${table}" t WHERE "tenantId" IS DISTINCT FROM $1`,runtime.ids.tenant));
  own[table]=await readTx(tx=>tx.$queryRawUnsafe(`SELECT id,md5(row_to_json(t)::text) AS digest FROM "${table}" t WHERE "tenantId"=$1 ORDER BY id`,runtime.ids.tenant));
  if(baseline){
    assert.deepEqual(history[table],baseline.history[table],table+' other tenants changed');
    const current=new Map(own[table].map(row=>[row.id,row.digest]));
    for(const old of baseline.own[table])assert.equal(current.get(old.id),old.digest,table+' old row changed');
  }
}
const sources=previous.sources;
for(const f of sources)assert.equal(sha(readFileSync(root+f.path)),f.sha256,'Old source changed');
const oldProcesses=execFileSync('ps',['-p','719,722,729,737,57090,70526,70537,70542','-o','pid=,lstart=,command='],{encoding:'utf8'});
assert.equal(oldProcesses,previous.oldProcesses);
const auth=await readTx(async tx=>({
  roles:await tx.permissionRole.findMany({where:{tenantId:runtime.ids.tenant},orderBy:{id:'asc'}}),
  assignments:await tx.skillAssignment.findMany({where:{tenantId:runtime.ids.tenant},orderBy:{id:'asc'}}),
}));
const ledger=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/ai-budget-20261022.json'));
const spentMicroCny=ledger.records.reduce((n,r)=>n+(r.costMicroCny??r.reservedMicroCny),0);
assert.equal(ledger.limitMicroCny,5000000);assert.ok(spentMicroCny<=5000000);assert.ok(ledger.records.every(r=>r.status==='known'),'Unknown fees: stop new calls');
if(baseline){assert.deepEqual(JSON.parse(JSON.stringify(auth)),baseline.auth);assert.deepEqual(ledger.records.slice(0,baseline.ledger.records.length),baseline.ledger.records);assert.equal(ledger.priceValidUntil,baseline.ledger.priceValidUntil);}
const frozen=[];
for(const name of ['development-admission','service-reuse','knowledge-frontend','local-knowledge-runtime','knowledge-ai','research-plan','synthetic-quality','synthetic-report','synthetic-asset']){
  const p=root+'docs/test/evidence/2026-10-22-researchhub-'+name+'/',m=JSON.parse(readFileSync(p+'manifest.json'));
  for(const e of m.entries??m.files)assert.equal(sha(readFileSync(e.path.startsWith('docs/test/evidence/')?root+e.path:p+e.path)),e.sha256);
  frozen.push({name,entries:(m.entries??m.files).length});
}
assert.equal(frozen.reduce((n,f)=>n+f.entries,0),1053);
const result={at:new Date().toISOString(),passed:true,sources,oldProcesses,history,own,auth,ledger,spentMicroCny,frozen,runtimePid:runtime.pid};
writeFileSync(out+(baselineMode?'baseline.json':'preservation.json'),JSON.stringify(result,null,2),baselineMode?{flag:'wx'}:{});
console.log(JSON.stringify({passed:true,baseline:baselineMode,oldSources:sources.length,oldProcesses:8,historyTables:protectedTables.length,
  protectedOwnRows:baseline?Object.fromEntries(Object.entries(baseline.own).map(([t,rows])=>[t,rows.length])):Object.fromEntries(Object.entries(own).map(([t,rows])=>[t,rows.length])),
  frozenEntries:1053,newCalls:baseline?ledger.records.length-baseline.ledger.records.length:0,spentMicroCny}));
