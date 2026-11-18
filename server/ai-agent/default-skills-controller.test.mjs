import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHubSkillController} from './default-skills-controller.mjs';
const require=createRequire(new URL('../../../app/server/package.json',import.meta.url));

test('Hub skill catalog only reads current identity, without Study or administration gates',async()=>{
 const user={accountId:'new',tenantId:'hub',authVersion:0};let called=false,noStore=false;
 const Controller=createHubSkillController({require,skills:{list:async principal=>{assert.equal(principal,user);called=true;return{items:[{key:'one',equipped:true,executionReady:false}]};}}});
 const actual=await new Controller().list({user,query:{},res:{setHeader(k,v){noStore=k==='Cache-Control'&&v==='no-store';}}});
 assert.equal(actual.items.length,1);assert(called&&noStore);
 await assert.rejects(()=>new Controller().list({user,query:{accountId:'other'}}),e=>e.getStatus()===400);
});

test('catalog failures retain authentication/authorization meaning without leaking internals',async()=>{
 for(const [code,status]of [['HUB_SKILL_ACCESS_DENIED',403],['HUB_SKILL_RELEASE_CHANGED',503],['unknown credential database error',503]]){
  const Controller=createHubSkillController({require,skills:{list:async()=>{throw Object.assign(Error(code),{code});}}});
  await assert.rejects(()=>new Controller().list({query:{}}),e=>e.getStatus()===status&&!e.message.includes('credential'));
 }
});
