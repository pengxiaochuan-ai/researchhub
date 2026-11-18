// Read-only evidence for the named synthetic invitation; no token or credential output.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const privateDir=root+'.tmp/researchhub-real-entry/';
const fixture=JSON.parse(readFileSync(privateDir+'invitation-fixture.json','utf8'));
const state=JSON.parse(readFileSync(privateDir+'invitation-run.json','utf8'));
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
const result=await withFixtureTransaction(env,'direct',async tx=>{
  const accounts=await tx.$queryRawUnsafe('SELECT id,"emailVerifiedAt" AS verified_at FROM public.account WHERE "tenantId"=$1 AND "emailNormalized"=$2',fixture.tenantId,fixture.inviteeEmail);
  assert.equal(accounts.length,1);assert(accounts[0].verified_at);
  const inviteeId=accounts[0].id;
  const invites=await tx.$queryRawUnsafe('SELECT id,"issuedBy","acceptedBy","acceptedAt","deliveryStatus","messageId","messageDigest","studyGroupId","researchProjectId","targetRoleId","targetProjectRoleKey","createdAt" FROM research_member_invitation WHERE "tenantId"=$1 AND "studyGroupId"=$2 AND "researchProjectId"=$3 AND email=$4',fixture.tenantId,fixture.groupId,fixture.projectId,fixture.inviteeEmail);
  assert.equal(invites.length,1);
  const invite=invites[0];
  assert.equal(invite.issuedBy,fixture.inviterId);assert.equal(invite.acceptedBy,inviteeId);
  assert(invite.acceptedAt);assert.equal(invite.deliveryStatus,'captured');
  assert.equal(invite.messageId,state.receipt.id);assert.equal(invite.messageDigest,state.receipt.digest);
  assert.equal(invite.targetRoleId,fixture.readerRoleId);assert.equal(invite.targetProjectRoleKey,'researcher');
  const groups=await tx.studyGroupMembership.findMany({where:{tenantId:fixture.tenantId,accountId:inviteeId}});
  const projects=await tx.researchProjectMembership.findMany({where:{tenantId:fixture.tenantId,accountId:inviteeId}});
  assert.equal(groups.length,1);assert.equal(groups[0].studyGroupId,fixture.groupId);assert.equal(groups[0].roleId,fixture.readerRoleId);
  assert.equal(projects.length,1);assert.equal(projects[0].researchProjectId,fixture.projectId);assert.equal(projects[0].roleKey,'researcher');
  const audits=await tx.auditLog.findMany({where:{tenantId:fixture.tenantId,target:invite.id,action:{in:['wp02_member_invitation_issued','wp02_member_invitation_accepted']}},select:{action:true}});
  assert.deepEqual(audits.map(row=>row.action).sort(),['wp02_member_invitation_accepted','wp02_member_invitation_issued']);
  return {at:new Date().toISOString(),passed:true,fixtureRunKey:fixture.runKey,invitationId:invite.id,issuedAt:invite.createdAt.toISOString(),acceptedAt:invite.acceptedAt.toISOString(),deliveryStatus:invite.deliveryStatus,receiptMatches:true,inviteeStudyCount:groups.length,inviteeProjectCount:projects.length,readerRoleId:fixture.readerRoleId,projectRoleKey:projects[0].roleKey,auditActions:audits.map(row=>row.action).sort(),noTokenRead:true};
},{readOnly:true});
writeFileSync(root+'docs/test/evidence/2026-10-28-researchhub-real-entry/invitation-readback.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({passed:true,oneInvitation:true,oneStudy:true,auditActions:result.auditActions.length}));
