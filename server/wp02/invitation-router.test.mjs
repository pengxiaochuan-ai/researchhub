import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {createInvitationRouter} from './invitation-router.mjs';

const old={tenantId:'synthetic',groupId:'old-group',projectId:'old-project'};
const current={tenantId:'synthetic',groupId:'new-group',projectId:'new-project'};
test('optional fixed invitation target uses only server-stored role and rejects a changed parent',async()=>{
 const token=randomBytes(32).toString('base64url'),row={studyGroupId:current.groupId,researchProjectId:current.projectId,targetRoleId:'asset-only',email:'member@example.test'};
 const db={transaction:async run=>run({$queryRawUnsafe:async()=>[row]})};let received;
 const makeService=target=>({preview:async()=>target.readerRoleId});
 const router=createInvitationRouter({tenantId:'synthetic',db,targets:[],makeService,resolveInvitationTarget:async value=>{received=value;return{...current,readerRoleId:'asset-only'};}});
 assert.equal(await router.preview({targetRoleId:'untrusted'},{token}),'asset-only');assert.equal(received.targetRoleId,'asset-only');
 const wrong=createInvitationRouter({tenantId:'synthetic',db,targets:[],makeService,resolveInvitationTarget:async()=>({...old,readerRoleId:'asset-only'})});
 await assert.rejects(wrong.preview({}, {token}),e=>e.status===404);
});
function setup(row){
  const called=[];
  const db={transaction:async fn=>fn({$queryRawUnsafe:async(_sql,tenant,hash)=>{called.push(['lookup',tenant,hash]);return row?[row]:[];}})};
  const router=createInvitationRouter({tenantId:'synthetic',db,targets:[old,current],makeService:target=>Object.fromEntries(
    ['context','list','issue','revoke','resend','preview','accept'].map(method=>[method,async(...args)=>{called.push([target.projectId,method,args.length]);return {projectId:target.projectId,method};}]),
  )});
  return {router,called};
}

test('scoped operations route only to the exact existing Study without falling back',async()=>{
  const {router,called}=setup();
  const ctx={groupId:current.groupId,projectId:current.projectId};
  assert.equal((await router.context(ctx)).projectId,current.projectId);
  assert.equal((await router.issue(ctx,{email:'synthetic@example.test'})).projectId,current.projectId);
  assert.equal((await router.revoke(ctx,'invite-id',{baseVersion:1})).projectId,current.projectId);
  assert.throws(()=>router.context({groupId:old.groupId,projectId:current.projectId}),e=>e.status===403);
  assert.deepEqual(called.map(row=>row[0]),[current.projectId,current.projectId,current.projectId]);
});

test('token operations select server-side tenant-bound target, never client-supplied scope',async()=>{
  const token=randomBytes(32).toString('base64url');
  const {router,called}=setup({studyGroupId:current.groupId,researchProjectId:current.projectId});
  const ctx={groupId:old.groupId,projectId:old.projectId};
  assert.equal((await router.preview(ctx,{token})).projectId,current.projectId);
  assert.equal((await router.accept(ctx,{token,requestKey:'accept-key'})).projectId,current.projectId);
  assert.deepEqual(called.filter(row=>row[0]==='lookup').map(row=>row.slice(1)),[
    ['synthetic',createHash('sha256').update(token).digest('hex')],
    ['synthetic',createHash('sha256').update(token).digest('hex')],
  ]);
});

test('unknown or unconfigured token cannot disclose another Study or call a service',async()=>{
  const token=randomBytes(32).toString('base64url');
  for(const row of [null,{studyGroupId:'unconfigured',researchProjectId:'unknown'}]){
    const {router,called}=setup(row);
    await assert.rejects(router.preview({}, {token}),e=>e.status===404);
    assert.equal(called.filter(item=>item[0]!=='lookup').length,0);
  }
});

test('duplicate or cross-tenant configured targets are rejected at startup',()=>{
  const makeService=()=>({});const db={transaction:async()=>[]};
  assert.throws(()=>createInvitationRouter({tenantId:'synthetic',db,targets:[old,old],makeService}));
  assert.throws(()=>createInvitationRouter({tenantId:'synthetic',db,targets:[old,{...current,tenantId:'foreign'}],makeService}));
});
