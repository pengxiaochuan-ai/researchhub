// Free only: never launches old stateful fixtures, providers or Workers.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
assert.deepEqual(process.argv.slice(2),['--mode','local-synthetic']);
const root='/Users/mac/aisciencesys/',cwd=root+'researchhub',out=root+'docs/test/evidence/2026-10-26-researchhub-wp09-asset-applicability/free-gates-'+randomUUID().slice(0,8)+'/';
mkdirSync(out,{recursive:true,mode:0o700});
const ledger=root+'.tmp/researchhub-knowledge-local/ai-budget-20261022.json',sha=()=>createHash('sha256').update(readFileSync(ledger)).digest('hex'),before=sha(),checks=[];
function run(name,cmd,args){const r=spawnSync(cmd,args,{cwd,encoding:'utf8',maxBuffer:12*1024*1024});writeFileSync(out+name+'.log',(r.stdout??'')+(r.stderr??''));const count=r.stdout?.match(/(?:^|\n)(?:ℹ|#) tests (\d+)/)?.[1];checks.push({name,exitCode:r.status,...(count?{tests:Number(count)}:{})});assert.equal(r.status,0,'WP09_FREE_GATE_FAILED:'+name);}
try{
 const files=['tests','server/wp02','scripts'].flatMap(dir=>readdirSync(cwd+'/'+dir).filter(f=>f.endsWith('.test.mjs')).map(f=>dir+'/'+f));
 run('pure-tests',process.execPath,['--test',...files]);run('existing-compiled-kernel',process.execPath,['scripts/wp02-kernel.mjs']);run('build','pnpm',['run','build']);run('preservation',process.execPath,['scripts/asset-applicability-preservation.mjs','verify-approved','--mode','local-synthetic']);run('whitespace','git',['diff','--check']);
 assert.equal(sha(),before);writeFileSync(out+'result.json',JSON.stringify({passed:true,checks,modelCalls:0,ledgerUnchanged:true,professionalAcceptance:false},null,2));console.log(JSON.stringify({passed:true,checks,evidence:out,modelCalls:0}));
}catch(e){writeFileSync(out+'failure.json',JSON.stringify({passed:false,checks,message:e.message,modelCalls:0},null,2));throw e;}finally{assert.equal(sha(),before);}
