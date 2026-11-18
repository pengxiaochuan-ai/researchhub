// One guarded, read-only baseline for this WP05 run; never rewrites older evidence.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),baselineFile=root+'researchhub/.superpowers/sdd/wp05-design-20261023/preservation.json';
const initial=process.argv[2]==='baseline',authorizedAi=process.argv[2]==='verify-authorized-ai';assert(initial||authorizedAi||process.argv[2]==='verify');if(initial)assert(!existsSync(baselineFile),'Do not replace an existing baseline.');
const previous=JSON.parse(readFileSync(root+'docs/test/evidence/2026-10-23-researchhub-wp02/preservation.json'));
const old=initial?null:JSON.parse(readFileSync(baselineFile));
const sha=b=>createHash('sha256').update(b).digest('hex'),sources=previous.sources.map(s=>({path:s.path,sha256:sha(readFileSync(root+s.path))}));
const ledgerSha=sha(readFileSync(root+'.tmp/researchhub-knowledge-local/ai-budget-20261022.json'));
const oldProcesses=execFileSync('ps',['-p','719,722,729,737,57090,70526,70537,70542','-o','pid=,lstart=,command='],{encoding:'utf8'});
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const rows={};for(const[table,cols]of Object.entries(previous.columns)){
 assert.match(table,/^[a-z_]+$/);for(const col of cols)assert.match(col,/^[A-Za-z][A-Za-z0-9_]*$/);
 const fields=cols.map(c=>'"'+c+'"').join(',');
 rows[table]=await withFixtureTransaction(env,'direct',tx=>tx.$queryRawUnsafe(`SELECT id,md5(row_to_json(t)::text) AS digest FROM (SELECT ${fields} FROM public."${table}") t ORDER BY id`),{readOnly:true});
 if(old){const current=new Map(rows[table].map(r=>[r.id,r.digest]));for(const r of old.rows[table])assert.equal(current.get(r.id),r.digest,'Previous synthetic row changed:'+table+':'+r.id);}
}
const frozen=[];
for(const item of [...previous.frozen.map(f=>({prefix:'2026-10-22-researchhub-'+f.name})),{prefix:'2026-10-23-researchhub-wp02'}]){
 const dir=root+'docs/test/evidence/'+item.prefix+'/',m=JSON.parse(readFileSync(dir+'manifest.json'));
 for(const f of m.entries??m.files){const p=f.path.startsWith('docs/test/evidence/')?root+f.path:dir+f.path;assert.equal(sha(readFileSync(p)),f.sha256,'Frozen evidence changed');frozen.push({path:p.slice(root.length),sha256:f.sha256});}
}
if(old){assert.deepEqual(sources,old.sources);if(authorizedAi){const ledger=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/ai-budget-20261022.json'));assert.equal(ledger.limitMicroCny,5000000);assert.equal(ledger.priceValidUntil,'2026-10-24T06:12:50.000Z');assert.equal(sha(JSON.stringify(ledger.records.slice(0,33))),'6d51c9f184d47d76cc5f1b80a50446379ac233f20c77de6cb72a05e8551c27ec');assert(ledger.records.every(r=>r.status==='known'));assert(ledger.records.reduce((n,r)=>n+r.costMicroCny,0)<=ledger.limitMicroCny);const dir=root+'docs/test/evidence/2026-10-23-researchhub-wp05-design/',m=JSON.parse(readFileSync(dir+'manifest.json'));for(const f of m.entries){const path=f.path.startsWith('docs/test/evidence/')?root+f.path:dir+f.path;assert.equal(sha(readFileSync(path)),f.sha256,'T01/T02 evidence changed');}}else assert.equal(ledgerSha,old.ledgerSha);assert.equal(oldProcesses,old.oldProcesses);assert.deepEqual(frozen,old.frozen);}
const result={passed:true,scope:'dedicated_synthetic_read_only_snapshot',sources,ledgerSha,oldProcesses,rows,frozen};if(initial)writeFileSync(baselineFile,JSON.stringify(result),{flag:'wx',mode:0o600});
console.log(JSON.stringify({passed:true,baseline:initial,oldSources:sources.length,protectedTables:Object.keys(rows).length,protectedOldRows:old?Object.values(old.rows).reduce((n,a)=>n+a.length,0):Object.values(rows).reduce((n,a)=>n+a.length,0),frozenFiles:frozen.length,ledgerUnchanged:!authorizedAi,originalLedgerPrefixPreserved:authorizedAi,authorizedAiChangesOnly:authorizedAi,oldServicesUnchanged:true}));
