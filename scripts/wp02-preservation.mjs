import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),out=root+'docs/test/evidence/2026-10-23-researchhub-wp02/';
mkdirSync(out,{recursive:true});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const prior=JSON.parse(readFileSync(root+'docs/test/evidence/2026-10-22-researchhub-research-flow-e2e/baseline.json'));
const baselineFile=out+'baseline.json',baselineMode=process.argv[2]==='baseline';
if(baselineMode)assert(!existsSync(baselineFile),'WP02_BASELINE_EXISTS');
const baseline=baselineMode?null:JSON.parse(readFileSync(baselineFile));
for(const s of prior.sources){
 let bytes=readFileSync(root+s.path);
 if(s.path==='app/server/prisma/schema.prisma'&&!baselineMode){
  // Invert only this round's approved additive schema. All original bytes must match.
  bytes=bytes.toString().replace(/\/\/ WP02 extensions[\s\S]*?(?=\/\/ 能力\/页面级权限)/,'').split('\n').filter(line=>!/^  (accountActionChallenges\s+AccountActionChallenge\[\]|researchMemberInvitations\s+ResearchMemberInvitation\[\]|wp02RequestWindows\s+Wp02RequestWindow\[\]|emailNormalized String\?|emailVerifiedAt DateTime\?|actionChallenges\s+AccountActionChallenge\[\]|sentMemberInvitations\s+ResearchMemberInvitation\[\]|acceptedMemberInvitations\s+ResearchMemberInvitation\[\]|memberInvitations\s+ResearchMemberInvitation\[\]|@@unique\(\[tenantId, emailNormalized\])/.test(line)).join('\n');
 }
 assert.equal(sha(bytes),s.sha256,'WP02_OLD_SOURCE_CHANGED:'+s.path);
}
const frozen=[];
for(const name of [...prior.frozen.map(f=>f.name),'research-flow-e2e']){
 const base=root+'docs/test/evidence/2026-10-22-researchhub-'+name+'/',manifest=JSON.parse(readFileSync(base+'manifest.json'));
 for(const f of manifest.entries??manifest.files)assert.equal(sha(readFileSync(f.path.startsWith('docs/test/evidence/')?root+f.path:base+f.path)),f.sha256,'WP02_FROZEN_CHANGED');
 frozen.push({name,count:(manifest.entries??manifest.files).length});
}assert.equal(frozen.reduce((n,f)=>n+f.count,0),1250);
const oldProcesses=execFileSync('ps',['-p','719,722,729,737,57090,70526,70537,70542','-o','pid=,lstart=,command='],{encoding:'utf8'});assert.equal(oldProcesses,prior.oldProcesses);
const ledger=readFileSync(root+'.tmp/researchhub-knowledge-local/ai-budget-20261022.json'),ledgerSha=sha(ledger);
if(baseline)assert.equal(ledgerSha,baseline.ledgerSha,'WP02_AI_LEDGER_CHANGED');
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const tables=[...new Set([...Object.keys(prior.history),'account','permission_role','study_group','study_group_membership','research_project','research_project_membership','account_capability','agent_access','skill_assignment'])];
const columns={},rows={};
for(const table of tables){assert.match(table,/^[a-z_]+$/);await withFixtureTransaction(env,'direct',async tx=>{
 columns[table]=baseline?.columns[table]??(await tx.$queryRawUnsafe('SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 ORDER BY ordinal_position','public',table)).map(r=>r.column_name);
 for(const col of columns[table])assert.match(col,/^[A-Za-z][A-Za-z0-9_]*$/);
 const fields=columns[table].map(c=>'"'+c+'"').join(',');
 rows[table]=await tx.$queryRawUnsafe(`SELECT id,md5(row_to_json(t)::text) AS digest FROM (SELECT ${fields} FROM public."${table}") t ORDER BY id`);
 if(baseline){const current=new Map(rows[table].map(r=>[r.id,r.digest]));for(const r of baseline.rows[table])assert.equal(current.get(r.id),r.digest,'WP02_OLD_ROW_CHANGED:'+table+':'+r.id);}
 },{readOnly:true});}
const result={at:new Date().toISOString(),passed:true,columns,rows,ledgerSha,oldProcesses,frozen,sources:prior.sources};
writeFileSync(out+(baselineMode?'baseline.json':'preservation.json'),JSON.stringify(result,null,2),baselineMode?{flag:'wx'}:{});
console.log(JSON.stringify({passed:true,baseline:baselineMode,protectedTables:tables.length,originalRows:Object.values(rows).reduce((n,r)=>n+r.length,0),frozenEntries:1250,newAiCalls:0}));
