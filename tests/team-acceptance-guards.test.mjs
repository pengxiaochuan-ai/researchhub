import test from 'node:test';import assert from 'node:assert/strict';
import {recoverReviewedTeamIds,assertTeamDetailWrites} from '../scripts/team-acceptance-guards.mjs';
const fixture=()=>({syntheticOnly:true,id:'new-team',name:'合成团队',leadName:'合成负责人',before:{entities:[{item:{id:'old'}}]}});
const workspace=()=>({id:'new-team',hasPublished:true,hasDraft:true,version:2,reviewedVersion:2,data:{name:'合成团队',organization:{entityId:'new-org'},members:[{entityId:'new-person',name:'合成负责人',role:'lead'}]}});
test('first committed review recovers missing IDs without creation or guessing; partial IDs must agree',()=>{
 const f=fixture();assert.deepEqual(recoverReviewedTeamIds(f,workspace()),{...f,organizationId:'new-org',leadId:'new-person'});assert.equal(f.organizationId,undefined);
 assert.throws(()=>recoverReviewedTeamIds({...f,leadId:'different'},workspace()));
 for(const patch of [{id:'other'},{hasPublished:false},{reviewedVersion:1},{data:{...workspace().data,members:[...workspace().data.members,...workspace().data.members]}},{data:{...workspace().data,organization:{entityId:'old'}}}])assert.throws(()=>recoverReviewedTeamIds(f,{...workspace(),...patch}));
});
test('details acceptance rejects any unexpected write even if it was aborted, and requires exactly save then review',()=>{
 const api='/api/hubs/lingshu-xinyu/directory-admin/team-workspaces/new-team';const expected=[{method:'POST',path:api},{method:'POST',path:api+'/reviews'}];assertTeamDetailWrites(expected,'new-team');
 for(const writes of [[],expected.slice(0,1),[...expected,{method:'POST',path:api+'/delete'}],[{method:'PATCH',path:api},expected[1]],[expected[1],expected[0]]])assert.throws(()=>assertTeamDetailWrites(writes,'new-team'));
});
