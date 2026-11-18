// Test setup only: the outbound callback is a substitute that reports UNKNOWN.
// It does not send email or prove T12. The token stays in the caller's memory.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHmac} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {workspaceRoot,fixtureEnvironment} from './research-creation-fixture.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
export async function mintSyntheticH5Invitation(benchmark,visitId){
 const env=fixtureEnvironment();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');assert.equal(benchmark.syntheticOnly,true);assert(visitId);
 const runtime=JSON.parse(readFileSync(workspaceRoot+'.tmp/researchhub-knowledge-local/runtime.json'));assert.equal(benchmark.scope.tenantId,runtime.ids.tenant);
 process.env.CONTACT_ENCRYPTION_KEY=createHmac('sha256',runtime.secret).update('researchhub:local-contact:v1').digest('hex');
 const require=createRequire(workspaceRoot+'app/server/package.json');require('ts-node').register({project:workspaceRoot+'app/server/tsconfig.json',transpileOnly:true});
 const core=require(workspaceRoot+'app/server/src/study-operations/formal-outreach.ts'),direct=fn=>withFixtureTransaction(env,'direct',fn);
 const account=await direct(async tx=>{const [marker]=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${benchmark.runId}`;assert.equal(marker?.manifest?.syntheticOnly,true);assert.equal(marker.manifest.studyId,benchmark.study.id);assert(await tx.subjectVisit.findFirst({where:{...benchmark.scope,id:visitId,acceptanceFixture:false}}));return tx.account.findUnique({where:{id:runtime.ids.admin}});});
 const user={accountId:account.id,tenantId:account.tenantId,authVersion:account.authVersion,role:account.role,isTenantAdmin:true};
 const prepared=await direct(async tx=>{const p=await core.registerEmailRecipientInTransaction(tx,user,benchmark.scope,{visitId,address:'synthetic@example.test',emailConsentConfirmed:true});return core.prepareEmailInvitationInTransaction(tx,user,benchmark.scope,{visitId,formVersionId:benchmark.refs.form,participantId:p.participantId});});
 let token;
 await direct(tx=>core.sendEmailInvitationInTransaction(tx,user,benchmark.scope,prepared.capability,async(_address,value)=>{token=value;return {status:'unknown'};}));
 assert.equal(typeof token,'string');return {token,assignmentId:prepared.assignmentId,invitationId:prepared.invitationId};
}
