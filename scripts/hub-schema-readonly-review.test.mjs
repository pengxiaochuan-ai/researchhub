import test from 'node:test';
import assert from 'node:assert/strict';
import {validateHubSchemaSnapshot,followGuardBody} from './hub-schema.mjs';
const expression="(tenant_id = current_setting('app.tenant_id'::text, true))";
const policies=()=>[['hub','hub_tenant'],['hub_follow','follow_tenant'],['scope_version','scope_tenant']].map(([table,name])=>({table,name,command:'*',permissive:true,roles:[0],usingExpression:expression,checkExpression:table==='hub_follow'?expression:null}));
const valid=()=>({policies:policies(),tables:['hub','hub_follow','scope_version'].map(name=>({name,rls:true,forced:true})),guard:{name:'follow_account_tenant_guard',functionSchema:'rh_hub',functionName:'assert_follow_account_tenant',enabled:'O',type:23,securityDefiner:true,config:['search_path=pg_catalog, public, rh_hub'],args:0,language:'plpgsql',returnType:'trigger',body:followGuardBody,tgattr:'',tgqual:null},tenantActive:true,adminActive:true,hubs:['lingshu-xinyu'],seed:true});
test('independent negative: UPDATE OF column-restricted follow guard must fail read-only preflight',()=>{const state=valid();state.guard.tgattr='2';assert.throws(()=>validateHubSchemaSnapshot(state),/HUB_FOLLOW_GUARD_CONFLICT/);});
test('independent negative: WHEN-conditional follow guard must fail read-only preflight',()=>{const state=valid();state.guard.tgqual='false';assert.throws(()=>validateHubSchemaSnapshot(state),/HUB_FOLLOW_GUARD_CONFLICT/);});
test('independent negative: missing tenant RLS policies must fail even when ENABLE/FORCE flags stay true',()=>{const state={...valid(),policies:[]};assert.throws(()=>validateHubSchemaSnapshot(state),/HUB_/);});
test('independent negative: permissive cross-tenant policy must fail even when ENABLE/FORCE flags stay true',()=>{const state={...valid(),policies:[{table:'hub',name:'hub_tenant',command:'*',permissive:true,roles:[0],usingExpression:'true',checkExpression:null}]};assert.throws(()=>validateHubSchemaSnapshot(state),/HUB_/);});

test('independent canonical snapshot is accepted',()=>assert.doesNotThrow(()=>validateHubSchemaSnapshot(valid())));
test('independent negative: an additional permissive policy must not weaken the canonical three',()=>{const state=valid();state.policies.push({table:'hub',name:'extra_allow_all',command:'*',permissive:true,roles:[0],usingExpression:'true',checkExpression:null});assert.throws(()=>validateHubSchemaSnapshot(state),/HUB_/);});
test('independent negative: follow WITH CHECK and policy role/command are part of the fixed contract',()=>{for(const change of [{checkExpression:null},{roles:[1]},{command:'r'},{permissive:false}]){const state=valid();state.policies[1]={...state.policies[1],...change};assert.throws(()=>validateHubSchemaSnapshot(state),/HUB_/);}});
