import assert from 'node:assert/strict';

// Restore only IDs already committed by the one named fixture's first review.
// No API write, creation, lookup by similar name, or retry is performed here.
export function recoverReviewedTeamIds(fixture,workspace){
 assert(fixture.syntheticOnly&&fixture.id&&fixture.name&&fixture.leadName);
 assert.equal(workspace.id,fixture.id);assert.equal(workspace.data.name,fixture.name);
 assert(workspace.hasPublished&&Number.isSafeInteger(workspace.reviewedVersion)&&workspace.reviewedVersion>0&&workspace.version===workspace.reviewedVersion);
 const leads=workspace.data.members.filter(m=>m.name===fixture.leadName&&m.role==='lead');assert.equal(leads.length,1);
 const organizationId=workspace.data.organization.entityId,leadId=leads[0].entityId;assert(organizationId&&leadId&&organizationId!==leadId);
 const originalIds=new Set(fixture.before.entities.map(e=>e.item.id));assert(!originalIds.has(organizationId)&&!originalIds.has(leadId));
 if(fixture.organizationId)assert.equal(fixture.organizationId,organizationId);if(fixture.leadId)assert.equal(fixture.leadId,leadId);
 return{...fixture,organizationId,leadId};
}
export function assertTeamDetailWrites(writes,teamId){
 assert(teamId);const path='/api/hubs/lingshu-xinyu/directory-admin/team-workspaces/'+teamId;
 assert.deepEqual(writes,[{path,method:'POST'},{path:path+'/reviews',method:'POST'}]);
}
