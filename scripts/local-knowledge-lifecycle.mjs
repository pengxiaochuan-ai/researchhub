import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';

const root=fileURLToPath(new URL('../../',import.meta.url));
const cli=root+'researchhub/scripts/local-knowledge.mjs',privateFile=root+'.tmp/researchhub-knowledge-local/runtime.json';
const out=root+'docs/test/evidence/2026-10-22-researchhub-local-knowledge-runtime/';mkdirSync(out,{recursive:true});
const command=action=>execFileSync(process.execPath,[cli,action],{cwd:root,encoding:'utf8',timeout:100000});
const read=()=>JSON.parse(readFileSync(privateFile));
const fingerprint=()=>{const{key,ids,password,secret}=read();return createHash('sha256').update(JSON.stringify({key,ids,password,secret})).digest('hex');};
const existing=read(),before=fingerprint(),started=command('start');
assert.ok(JSON.parse(command('status')).services.every(s=>s.ready));
assert.match(command('start'),/Already running/);
command('stop');
for(const port of [19501,19502,19503,19504]){
  const server=createServer();await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});await new Promise(resolve=>server.close(resolve));
}
command('start');
const final=JSON.parse(command('status'));assert.equal(final.owned,true);assert.ok(final.services.every(s=>s.ready));assert.equal(fingerprint(),before);assert.deepEqual(read().ids,existing.ids);
writeFileSync(out+'lifecycle.json',JSON.stringify({passed:true,checks:['idempotent-start','owned-stop-waits-for-all-four-ports','restart-all-four-healthy','same-tenant-account-and-session-secrets'],final,syntheticOnly:true},null,2));
console.log(JSON.stringify({passed:true,checks:4,final}));
