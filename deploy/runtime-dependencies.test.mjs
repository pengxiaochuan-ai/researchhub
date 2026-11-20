import test from 'node:test';
import assert from 'node:assert/strict';
import {coreLocation} from '../server/research-runtime/dependencies.mjs';
import {readResearchRuntimeConfig} from '../server/research-runtime/config.mjs';
test('release configuration refuses an implicit developer workspace dependency',()=>{
 const env={DATABASE_URL:'postgresql://test:synthetic@localhost/rehearsal',DIRECT_URL:'postgresql://owner:synthetic@localhost/rehearsal',JWT_SECRET:'x'.repeat(48),HUB_REQUIRE_PRIVATE_CORE:'true'};
 assert.throws(()=>readResearchRuntimeConfig(env),/CORE_PRIVATE_ROOT_REQUIRED/);
 assert.throws(()=>readResearchRuntimeConfig({...env,HUB_REQUIRE_PRIVATE_CORE:undefined,NODE_ENV:'production'}),/CORE_PRIVATE_ROOT_REQUIRED/);
});
test('private core cannot be a relative path or absent in required mode',()=>{
 assert.throws(()=>coreLocation({coreRoot:'../app',digest:'a'.repeat(64)}),/CORE_PRIVATE_ROOT_REQUIRED/);
 assert.throws(()=>coreLocation({requirePrivate:true}),/CORE_PRIVATE_ROOT_REQUIRED/);
});
test('normal local dependency resolution stays inside Hub instead of reading the old project',()=>{
 const root=coreLocation();assert(root.endsWith('/researchhub/.private/core/'));assert(!root.includes('/app/server/'));
});
