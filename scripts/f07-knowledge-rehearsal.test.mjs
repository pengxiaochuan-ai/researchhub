import test from 'node:test';
import assert from 'node:assert/strict';
import {f07RoleDelta} from './f07-knowledge-rehearsal.mjs';
const ids={tenant:'synthetic-tenant',reader:'synthetic-reader'};
const role={id:ids.reader+'-target-editor',tenantId:ids.tenant,key:'f06-target-editor',status:'active',menuPermissions:['workbench','artifacts'],buttonPermissions:['artifact.read','artifact.create','artifact.edit']};
test('owned role gains only knowledge menu/edit and preserves existing capability order',()=>{const before=structuredClone(role),next=f07RoleDelta(role,ids);assert.deepEqual(next,{menuPermissions:['workbench','artifacts','knowledge'],buttonPermissions:['artifact.read','artifact.create','artifact.edit','knowledge.edit']});assert.deepEqual(role,before);assert(!next.buttonPermissions.includes('chat.use'));assert.deepEqual(f07RoleDelta({...role,...next},ids),next);});
test('rejects non-owned, inactive, wildcard and malformed roles before any mutation',()=>{for(const patch of [{id:'other'},{tenantId:'other'},{key:'researcher'},{status:'disabled'},{menuPermissions:['*']},{buttonPermissions:['*']},{buttonPermissions:null}])assert.throws(()=>f07RoleDelta({...role,...patch},ids),/F07_OWNED_SCOPE_REJECTED/);});
