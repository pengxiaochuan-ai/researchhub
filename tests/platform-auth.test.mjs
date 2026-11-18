import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlatformAuth,presentIdentity} from '../src/platform-auth.js';
const me={accountId:'new',displayName:'合成读者',username:'reader@example.test',isTenantAdmin:false,studyGroups:[]};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
test('real mode starts checking, zero membership is not PI, tenant admin is not Study manager',async()=>{
 const users=[],c=createPlatformAuth({client:{me:async()=>me},setUser:v=>users.push(v),readScope:()=>({})});
 assert.equal(users[0].status,'checking');assert.notEqual(users[0].displayName,'王教授');await c.refresh();assert.equal(users.at(-1).roleName,'尚未加入私有Study');
 assert.equal(presentIdentity({...me,isTenantAdmin:true},{}).roleName,'租户管理员 · 无当前Study角色');
});
test('late me cannot override newer identity or acknowledged logout',async()=>{
 const a=deferred(),b=deferred(),users=[];let n=0;const c=createPlatformAuth({client:{me:()=>++n===1?a.promise:b.promise,logout:async()=>{}},setUser:v=>users.push(v)});
 const first=c.refresh(),second=c.refresh();b.resolve({...me,accountId:'second',displayName:'新账号'});await second;a.resolve(me);await first;assert.equal(users.at(-1).id,'second');await c.logout();assert.equal(users.at(-1).status,'anonymous');
});
test('logout invalidates earlier me and failed logout is explicit unavailable, not false success',async()=>{
 const d=deferred(),users=[],c=createPlatformAuth({client:{me:()=>d.promise,logout:async()=>{throw Error('network');}},setUser:v=>users.push(v)});const pending=c.refresh();await assert.rejects(c.logout());d.resolve(me);await pending;assert.equal(users.at(-1).status,'unavailable');assert.equal(users.at(-1).authenticated,false);
});
test('403 and network are unavailable, not false logout; dispose blocks late response',async()=>{
 const users=[],client={me:async()=>{throw Object.assign(Error('no'),{code:'AUTH_FORBIDDEN'});}},c=createPlatformAuth({client,setUser:v=>users.push(v)});await c.refresh();assert.equal(users.at(-1).status,'unavailable');client.me=async()=>{throw Error('network');};await c.refresh();assert.equal(users.at(-1).status,'unavailable');const d=deferred();client.me=()=>d.promise;const p=c.refresh();c.dispose();const n=users.length;d.resolve(me);await p;assert.equal(users.length,n);
});
test('verified identity survives network and 503 without changing its identity epoch; confirmed anonymous does expire',async()=>{let mode='ok',expired=0;const users=[],c=createPlatformAuth({client:{me:async()=>{if(mode==='error')throw Error('network');return mode==='ok'?me:null;}},setUser:v=>users.push(v),onExpired:()=>expired++});await c.refresh();mode='error';await c.refresh();assert.equal(users.at(-1).id,me.accountId);assert.equal(users.at(-1).authenticated,true);assert.equal(users.at(-1).status,'authenticated');assert.equal(users.at(-1).sessionHealth,'unavailable');assert.equal(expired,0);mode='expired';await c.refresh();assert.equal(expired,1);assert.equal(users.at(-1).authenticated,false);});
test('scope role comes only from matching server membership and does not turn researcher into PI',()=>{
 const user={...me,studyGroups:[{id:'g',name:'G',role:{name:'只读'},researchProjects:[{id:'p',name:'P',roleKey:'researcher'}]}]};
 assert.equal(presentIdentity(user,{studyGroupId:'g',researchProjectId:'p'}).roleName,'只读 · Study研究成员');assert.equal(presentIdentity(user,{studyGroupId:'g',researchProjectId:'other'}).roleName,'已登录 · 请选择已授权Study');
});
