import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
assert.deepEqual(process.argv.slice(2),['--mode','local-synthetic']);
const hub=fileURLToPath(new URL('../',import.meta.url)),root=fileURLToPath(new URL('../../',import.meta.url));
const out=hub+'docs/testing/evidence/study-tasks-s08-2026-11-02/free-gates-'+randomUUID()+'/';mkdirSync(out,{recursive:true});
const commands=[
 ['hub-tests','/bin/zsh',['-lc','node --test tests/*.test.mjs src/*.test.mjs server/study-tasks/*.test.mjs scripts/study-tasks-*.test.mjs'],hub],
 ['hub-build','pnpm',['build'],hub],
 ['legacy-study-operations','pnpm',['test:study-operations'],root+'app/server'],
 ['legacy-new-core','node',['--test','dist/study-operations/study-task-transaction.spec.js'],root+'app/server'],
 ['whitespace','git',['diff','--check'],hub],
 ];
const results=[];
for(const [name,cmd,args,cwd]of commands){
 const run=spawnSync(cmd,args,{cwd,encoding:'utf8',maxBuffer:24*1024*1024,timeout:180000});
 const output=(run.stdout??'')+(run.stderr??'');writeFileSync(out+name+'.log',output,{mode:0o600});
 const counts=output.match(/(?:ℹ|#) tests\s+(\d+)/g)??[];
 results.push({name,exitCode:run.status,signal:run.signal,tests:counts.map(v=>Number(v.match(/\d+/)[0])),log:name+'.log'});
 console.log(JSON.stringify(results.at(-1)));
 if(run.status!==0)break;
}
const files=['server/study-tasks/commands.mjs','server/study-tasks/controller.mjs','server/study-tasks/links.mjs','server/study-tasks/repository.mjs','pages/shared/StudyTasks.jsx','pages/shared/StudyTaskContext.jsx','pages/shared/StudyTaskListControls.jsx','src/study-task-list-state.js','src/study-tasks-session.js','scripts/local-knowledge-ai.mjs','scripts/local-knowledge.mjs'];
const hashes=Object.fromEntries(files.map(f=>[f,createHash('sha256').update(readFileSync(hub+f)).digest('hex')]));
const passed=results.length===commands.length&&results.every(r=>r.exitCode===0);writeFileSync(out+'result.json',JSON.stringify({passed,at:new Date().toISOString(),results,hashes,modelCalls:0,realBusinessAcceptance:false},null,2)+'\n');
console.log(JSON.stringify({passed,evidence:out}));if(!passed)process.exitCode=1;
