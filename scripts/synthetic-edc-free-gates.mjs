// Checkpoint gates only; never executes an AI request or an old fixture workflow.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
const approvedAi=process.argv[4]==='--approved-ai';assert.deepEqual(process.argv.slice(2),['--mode','local-synthetic',...(approvedAi?['--approved-ai']:[])]);
const root='/Users/mac/aisciencesys/',cwd=root+'researchhub',out=root+'docs/test/evidence/2026-10-23-researchhub-wp06-synthetic-edc/free-gates-'+randomUUID().slice(0,8)+'/';mkdirSync(out,{recursive:true});
const ledger=root+'.tmp/researchhub-knowledge-local/ai-budget-20261022.json',sha=()=>createHash('sha256').update(readFileSync(ledger)).digest('hex'),before=sha(),checks=[];
function run(name,cmd,args){const r=spawnSync(cmd,args,{cwd,encoding:'utf8',maxBuffer:12*1024*1024});writeFileSync(out+name+'.log',(r.stdout??'')+(r.stderr??''));checks.push({name,exitCode:r.status});assert.equal(r.status,0,'WP06_CHECKPOINT_FAILED:'+name);return r.stdout;}
try{
 const files=['tests','server/wp02','scripts'].flatMap(dir=>readdirSync(cwd+'/'+dir).filter(f=>f.endsWith('.test.mjs')).map(f=>dir+'/'+f));run('pure-tests',process.execPath,['--test',...files]);run('existing-kernel',process.execPath,['scripts/wp02-kernel.mjs']);run('build','pnpm',['run','build']);run('preservation',process.execPath,['scripts/synthetic-edc-preservation.mjs',approvedAi?'verify-approved-ai':'verify']);run('whitespace','git',['diff','--check']);
 assert.equal(sha(),before);writeFileSync(out+'result.json',JSON.stringify({passed:true,checks,paidCalls:0,ledgerUnchanged:true,notFinalAcceptance:true},null,2));console.log(JSON.stringify({passed:true,checks:checks.length,evidence:out}));
}catch(e){writeFileSync(out+'failure.json',JSON.stringify({passed:false,checks,message:e.message},null,2));throw e;}finally{assert.equal(sha(),before);}
