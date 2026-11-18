import test from 'node:test';
import assert from 'node:assert/strict';
import {memoizeFullStudyFixedPolicyReads} from './full-study-fixed-policy-reads.mjs';
import {fullStudyHash} from './full-study-projection.mjs';

function fixture(){
 const scope={tenantId:'t',studyGroupId:'g',researchProjectId:'p'},sections={dataUse:{status:'configured'}},c={scope,protocolVersionId:'protocol',policyId:'policy',policyHash:fullStudyHash(sections)};
 const state={protocol:{...scope,id:'protocol',acceptanceFixture:false,status:'executing',approvedPolicyVersionId:'policy',approvedPolicyHash:c.policyHash,title:'initial'},policy:{...scope,id:'policy',protocolVersionId:'protocol',status:'approved',contentHash:c.policyHash,sections,reviewedBy:'reviewer',reviewedAt:new Date(0)},protocolReads:0,policyReads:0,otherReads:0,rawCalls:0};
 const tx={studyProtocolVersion:{findFirst:async()=>{state.protocolReads++;return structuredClone(state.protocol);},findMany:async()=>{state.otherReads++;return[state.protocol];},update:async()=>{state.protocol.title='updated';}},studyExecutionPolicyVersion:{findFirst:async()=>{state.policyReads++;return structuredClone(state.policy);}},studyEnrollment:{findFirst:async()=>{state.otherReads++;return{id:'enrollment'};},update:async()=>{state.protocol.title='updated';}},$queryRaw:async()=>{state.rawCalls++;return[];},$executeRaw:async()=>{state.rawCalls++;return 1;},$queryRawUnsafe:async()=>{state.rawCalls++;return[];},$executeRawUnsafe:async()=>{state.rawCalls++;return 1;},$runCommandRaw:async()=>{state.rawCalls++;return{};}};
 const protocolArgs={where:{...scope,id:c.protocolVersionId,acceptanceFixture:false}},policyArgs={where:{...scope,id:c.policyId,protocolVersionId:c.protocolVersionId}};
 return{scope,c,state,tx,protocolArgs,policyArgs,view:memoizeFullStudyFixedPolicyReads(tx,scope,c)};
}
test('only fixed complete protocol/policy rows are reused after their first true read and copies cannot poison the witness',async()=>{
 const f=fixture(),p=await f.view.studyProtocolVersion.findFirst(f.protocolArgs);p.title='external mutation';
 assert.equal((await f.view.studyProtocolVersion.findFirst(f.protocolArgs)).title,'initial');assert.equal(f.state.protocolReads,1);
 const policy=await f.view.studyExecutionPolicyVersion.findFirst(f.policyArgs);policy.sections.dataUse.status='changed';policy.reviewedAt.setUTCFullYear(2030);
 assert.equal((await f.view.studyExecutionPolicyVersion.findFirst(f.policyArgs)).sections.dataUse.status,'configured');assert.equal((await f.view.studyExecutionPolicyVersion.findFirst(f.policyArgs)).reviewedAt.getUTCFullYear(),1970);assert.equal(f.state.policyReads,1);
 const full={where:{...f.policyArgs.where,status:'approved',contentHash:f.c.policyHash}};await f.view.studyExecutionPolicyVersion.findFirst(full);await f.view.studyExecutionPolicyVersion.findFirst(full);assert.equal(f.state.policyReads,2);
});
test('other ids/scopes, relations, status-only projections and other models or methods are never memoized',async()=>{
 const f=fixture();for(const args of [{where:{...f.protocolArgs.where,id:'other'}},{where:{...f.protocolArgs.where,tenantId:'other'}},{where:{id:'protocol'}},{...f.protocolArgs,include:{visitPlans:true}},{...f.protocolArgs,select:{id:true}},{where:{...f.protocolArgs.where,status:{in:['executing','superseded']}},select:{id:true}},{where:{...f.protocolArgs.where},take:1}]){const before=f.state.protocolReads;await f.view.studyProtocolVersion.findFirst(args);await f.view.studyProtocolVersion.findFirst(args);assert.equal(f.state.protocolReads-before,2);}
 for(const args of [{where:{...f.policyArgs.where,protocolVersionId:'other'}},{where:{...f.policyArgs.where,id:'other'}},{where:{...f.policyArgs.where,status:'draft'}},{...f.policyArgs,include:{protocol:true}},{...f.policyArgs,select:{id:true}}]){const before=f.state.policyReads;await f.view.studyExecutionPolicyVersion.findFirst(args);await f.view.studyExecutionPolicyVersion.findFirst(args);assert.equal(f.state.policyReads-before,2);}
 for(let i=0;i<2;i++){await f.view.studyEnrollment.findFirst({where:{id:'enrollment'}});await f.view.studyProtocolVersion.findMany(f.protocolArgs);}assert.equal(f.state.otherReads,4);
});
test('null, errors and mismatched protocol/policy approval facts never become cache entries',async()=>{
 for(const change of [f=>{f.state.policy=null;},f=>{f.state.policy.status='draft';},f=>{f.state.policy.contentHash='0'.repeat(64);},f=>{f.state.policy.sections={changed:true};},f=>{f.state.policy.tenantId='other';},f=>{f.state.policy.reviewedAt=null;}]){const f=fixture();change(f);await f.view.studyExecutionPolicyVersion.findFirst(f.policyArgs);await f.view.studyExecutionPolicyVersion.findFirst(f.policyArgs);assert.equal(f.state.policyReads,2);}
 for(const change of [f=>{f.state.protocol=null;},f=>{f.state.protocol.approvedPolicyHash='0'.repeat(64);},f=>{f.state.protocol.status='draft';},f=>{f.state.protocol.id='other';}]){const f=fixture();change(f);await f.view.studyProtocolVersion.findFirst(f.protocolArgs);await f.view.studyProtocolVersion.findFirst(f.protocolArgs);assert.equal(f.state.protocolReads,2);}
 const f=fixture();let calls=0;f.tx.studyProtocolVersion.findFirst=async()=>{calls++;throw Error('db failure');};for(let i=0;i<2;i++)await assert.rejects(f.view.studyProtocolVersion.findFirst(f.protocolArgs),/db failure/);assert.equal(calls,2);
});
test('all model writes and raw mutations, context changes, unsafe or unknown SQL clear both witnesses before and after',async()=>{
 const mutations=[v=>v.studyEnrollment.update({where:{id:'e'},data:{}}),v=>v.studyProtocolVersion.update({where:{id:'protocol'},data:{}}),v=>v.$queryRaw`UPDATE source SET flag=true RETURNING id`,v=>v.$executeRaw`DELETE FROM source`,v=>v.$executeRaw`SELECT set_config('app.tenant_id',${'other'},true)`,v=>v.$queryRaw`SELECT unknown_function(${1})`,v=>v.$queryRaw`SELECT "set_config"('app.tenant_id',${'other'},true)`,v=>v.$queryRawUnsafe('SELECT 1'),v=>v.$executeRawUnsafe('SELECT 1'),v=>v.$runCommandRaw({find:'source'}),v=>v.$queryRaw('SELECT id FROM source')];
 for(const mutate of mutations){const f=fixture();await f.view.studyProtocolVersion.findFirst(f.protocolArgs);await f.view.studyExecutionPolicyVersion.findFirst(f.policyArgs);await mutate(f.view);await f.view.studyProtocolVersion.findFirst(f.protocolArgs);await f.view.studyExecutionPolicyVersion.findFirst(f.policyArgs);assert.equal(f.state.protocolReads,2);assert.equal(f.state.policyReads,2);}
});
test('known read-only SELECT and exact current tenant authorization lock stay real calls without clearing fixed rows',async()=>{
 const f=fixture();await f.view.studyProtocolVersion.findFirst(f.protocolArgs);await f.view.$queryRaw`SELECT id FROM source WHERE id=${'id'} FOR UPDATE`;await f.view.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'wp01:tenant:t'},0))`;await f.view.studyProtocolVersion.findFirst(f.protocolArgs);assert.equal(f.state.protocolReads,1);assert.equal(f.state.rawCalls,2);
 await f.view.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'wp01:tenant:other'},0))`;await f.view.studyProtocolVersion.findFirst(f.protocolArgs);assert.equal(f.state.protocolReads,2);
});
test('epoch prevents a delayed pre-write read from repopulating invalidated entries',async()=>{
 const f=fixture();let release,entered;const reached=new Promise(r=>{entered=r;});const hold=new Promise(r=>{release=r;});let reads=0;
 f.tx.studyProtocolVersion.findFirst=async()=>{const value=structuredClone(f.state.protocol);if(++reads===1){entered();await hold;}return value;};
 const pending=f.view.studyProtocolVersion.findFirst(f.protocolArgs);await reached;await f.view.studyEnrollment.update({});release();assert.equal((await pending).title,'initial');assert.equal((await f.view.studyProtocolVersion.findFirst(f.protocolArgs)).title,'updated');assert.equal(reads,2);
});
test('reads during an in-flight or failed write cannot leave a reusable entry',async()=>{
 const f=fixture();let release,entered;const reached=new Promise(r=>{entered=r;});const hold=new Promise(r=>{release=r;});
 f.tx.studyEnrollment.update=async()=>{entered();await hold;f.state.protocol.title='updated';throw Error('write failed');};
 const write=f.view.studyEnrollment.update({});const rejected=assert.rejects(write,/write failed/);await reached;await f.view.studyProtocolVersion.findFirst(f.protocolArgs);release();await rejected;
 assert.equal((await f.view.studyProtocolVersion.findFirst(f.protocolArgs)).title,'updated');assert.equal(f.state.protocolReads,2);
});
test('separate project wrappers never share witnesses and installation rejects a mismatched fixed scope',async()=>{
 const f=fixture();await f.view.studyProtocolVersion.findFirst(f.protocolArgs);const next=memoizeFullStudyFixedPolicyReads(f.tx,f.scope,f.c);await next.studyProtocolVersion.findFirst(f.protocolArgs);assert.equal(f.state.protocolReads,2);
 assert.throws(()=>memoizeFullStudyFixedPolicyReads(f.tx,{...f.scope,tenantId:'other'},f.c),/FULL_STUDY_FIXED_POLICY_SCOPE_REQUIRED/);
});
test('SELECT INTO and CTE/comment SQL invalidate instead of being accepted as ordinary read-only SELECT',async()=>{
 for(const query of [v=>v.$queryRaw`SELECT id INTO TEMP duplicate_rows FROM source`,v=>v.$queryRaw`WITH modified AS (DELETE FROM source RETURNING id) SELECT id FROM modified`,v=>v.$queryRaw`SELECT id FROM source /* opaque */`]){
  const f=fixture();await f.view.studyProtocolVersion.findFirst(f.protocolArgs);await query(f.view);await f.view.studyProtocolVersion.findFirst(f.protocolArgs);assert.equal(f.state.protocolReads,2);
 }
});
