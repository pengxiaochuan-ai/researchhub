import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {saveDefaultSkillEvidence} from './qiyan-default-skills.mjs';

test('catalog reads and repeated applies never overwrite the original installation receipt',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'qiyan-default-evidence-'));
 const original={applied:true,created:9,equipped:9,preservation:{unchanged:true}};
 const first=await saveDefaultSkillEvidence(dir,original);
 const second=await saveDefaultSkillEvidence(dir,{applied:false,count:9});
 const third=await saveDefaultSkillEvidence(dir,{applied:true,created:0,equipped:0});
 assert.equal(new Set([first,second,third]).size,3);
 assert.deepEqual(JSON.parse(await readFile(first,'utf8')),original);
});
