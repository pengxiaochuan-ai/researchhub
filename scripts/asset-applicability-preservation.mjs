// Read-only synthetic catalog/row preservation. Never ensures a session or restores grants.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {LocalAiBudget} from './knowledge-ai-contract.mjs';
import {LocalApplicabilityFeeGuard} from './asset-applicability-fee.mjs';
assert.deepEqual(process.argv.slice(3),['--mode','local-synthetic'],'WP09_SYNTHETIC_MODE_REQUIRED');
const mode=process.argv[2];assert(['baseline','verify','verify-approved'].includes(mode),'WP09_MODE_INVALID');
const root='/Users/mac/aisciencesys/',privateDir=root+'.tmp/researchhub-wp09-asset-applicability/',file=privateDir+'preservation.json';
const sha=b=>createHash('sha256').update(b).digest('hex');
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const old=JSON.parse(readFileSync(root+'.tmp/researchhub-wp08-crf-method-assets/preservation.json'));
const sources=old.sources.map(s=>({path:s.path,sha256:sha(readFileSync(root+s.path))}));assert.deepEqual(sources,old.sources,'OLD_SOURCE_CHANGED');
const processes=execFileSync('ps',['-p','719,722,729,737,57090,70526,70537,70542','-o','pid=,lstart=,command='],{encoding:'utf8'});assert.equal(processes,old.processes,'OLD_PROCESS_CHANGED');
const rows=await withFixtureTransaction(env,'direct',async tx=>{
 const tables=await tx.$queryRawUnsafe('SELECT tablename FROM pg_tables WHERE schemaname=\'public\' ORDER BY tablename'),value={};
 for(const {tablename:t}of tables){assert.match(t,/^[A-Za-z_][A-Za-z0-9_]*$/);value[t]=await tx.$queryRawUnsafe(`SELECT COALESCE(row_to_json(t)->>'id','digest:'||md5(row_to_json(t)::text)) AS key,md5(row_to_json(t)::text) AS digest,count(*)::int AS count FROM public."${t}" t GROUP BY 1,2 ORDER BY 1,2`);}
 return value;
},{readOnly:true});
const ledgerPath=root+'.tmp/researchhub-knowledge-local/ai-budget-20261022.json',ledger=readFileSync(ledgerPath),budget=JSON.parse(ledger);assert.equal(budget.limitMicroCny,5000000);assert(budget.records.every(r=>r.status==='known'));let verifiedFee;
if(mode==='verify-approved'){verifiedFee=new LocalApplicabilityFeeGuard({approvalPath:privateDir+'fee-approval.json',budget:new LocalAiBudget(ledgerPath)}).verifyLedger();assert(budget.records.reduce((n,r)=>n+r.costMicroCny,0)<=5000000);}else assert.equal(budget.records.length,79);
const scopes=Object.fromEntries(['wp06-scope.json','wp07-scope.json','wp08-scope.json'].map(p=>[p,sha(readFileSync(root+'.tmp/researchhub-knowledge-local/'+p))]));
const value={schema:'rh-wp09-preservation.v1',sources,processes,rows,scopes,schemaHash:sha(readFileSync(root+'app/server/prisma/schema.prisma')),ledgerHash:verifiedFee?.baselineHash??sha(ledger)};
if(mode==='baseline'){assert(!existsSync(file),'BASELINE_ALREADY_EXISTS');mkdirSync(privateDir,{recursive:true,mode:0o700});writeFileSync(file,JSON.stringify(value),{flag:'wx',mode:0o600});}
else{
 const before=JSON.parse(readFileSync(file));assert.deepEqual({...value,rows:undefined},{...before,rows:undefined},'OLD_SOURCE_SCOPE_PROCESS_LEDGER_OR_SCHEMA_CHANGED');assert.deepEqual(Object.keys(rows),Object.keys(before.rows),'DATABASE_TABLE_SET_CHANGED');
 for(const [table,records]of Object.entries(before.rows)){const now=new Map(rows[table].map(r=>[r.key+':'+r.digest,r.count]));for(const r of records)assert((now.get(r.key+':'+r.digest)??0)>=r.count,'PRIOR_ROW_CHANGED:'+table);}
}
const protectedRows=mode!=='baseline'?JSON.parse(readFileSync(file)).rows:rows;
console.log(JSON.stringify({passed:true,mode,database:'wp01_test_full_baseline',protectedSources:sources.length,protectedTables:Object.keys(protectedRows).length,protectedRows:Object.values(protectedRows).flat().reduce((n,r)=>n+r.count,0),modelCalls:0,dbWrites:0,oldProcessesUnchanged:true,priorScopesUnchanged:true,ledgerUnchanged:sha(ledger)===value.ledgerHash,original79PrefixUnchanged:true,approvedNewCalls:verifiedFee?.added.length??0}));
