// Local synthetic verification only. No schema application, fixture repair or mail/AI sending.
import assert from'node:assert/strict';import{readFileSync,writeFileSync,mkdirSync}from'node:fs';import{spawnSync}from'node:child_process';import{fileURLToPath}from'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),cwd=root+'researchhub',out=root+'docs/test/evidence/2026-10-23-researchhub-wp02/gates/';mkdirSync(out,{recursive:true});
const checks=[];
function run(name,command,args){const result=spawnSync(command,args,{cwd,encoding:'utf8',maxBuffer:8*1024*1024});writeFileSync(out+name+'.log',(result.stdout??'')+(result.stderr??''));checks.push({name,exitCode:result.status});assert.equal(result.status,0,'WP02_GATE_FAILED:'+name);return result.stdout;}
const initial=JSON.parse(run('initial-status',process.execPath,['scripts/local-knowledge.mjs','status']));assert(initial.owned&&initial.services.length===7&&initial.services.every(s=>s.ready));
run('initial-preservation',process.execPath,['scripts/wp02-preservation.mjs','verify']);
const list=JSON.parse(run('test-files',process.execPath,['--input-type=module','-e',"import{readdirSync}from'node:fs';console.log(JSON.stringify(['tests','server/wp02'].flatMap(d=>readdirSync(d).filter(f=>f.endsWith('.test.mjs')).map(f=>d+'/'+f))))"]));
run('unit',process.execPath,['--test',...list]);run('pg',process.execPath,['scripts/wp02-pg.mjs','all']);run('kernel',process.execPath,['scripts/wp02-kernel.mjs']);
run('build','pnpm',['run','build']);run('shell',process.execPath,['scripts/wp02-shell-browser.mjs']);run('forms',process.execPath,['scripts/wp02-form-browser.mjs']);run('review-fixes',process.execPath,['scripts/wp02-review-browser.mjs']);run('zoom',process.execPath,['scripts/wp02-zoom-browser.mjs']);
const main=JSON.parse(readFileSync(root+'docs/test/evidence/2026-10-23-researchhub-wp02/browser/result.json'));assert(main.passed&&main.realSmtpCapture&&main.receipts.length>=3,'WP02_PRIMARY_BROWSER_PROOF_MISSING');
const race=JSON.parse(readFileSync(root+'docs/test/evidence/2026-10-23-researchhub-wp02/invitation-boundaries.json'));assert(race.passed&&race.independentConnections);
run('final-preservation',process.execPath,['scripts/wp02-preservation.mjs','verify']);run('diff-check','git',['diff','--check']);
writeFileSync(out+'result.json',JSON.stringify({at:new Date().toISOString(),passed:true,checks,primaryBrowserProofReusedNotReplayed:true,noPaidAiCalls:true,noCloudOrRelease:true},null,2));console.log(JSON.stringify({passed:true,checks:checks.length}));
