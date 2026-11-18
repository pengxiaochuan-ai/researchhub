import assert from 'node:assert/strict';
import test from 'node:test';
import {planStudyTaskFixture,validateStudyTaskFixture,assertStudyTaskFixtureBoundary} from './study-tasks-fixture.mjs';
const base=()=>({scope:{tenantId:'t',studyGroupId:'g',researchProjectId:'p'},ids:{owner:'owner',admin:'admin'},accounts:[{id:'owner',authVersion:0,isTenantAdmin:false,status:'active'},{id:'admin',authVersion:0,isTenantAdmin:false,status:'active'}],groupMemberships:[{id:'gm',accountId:'owner',studyGroupId:'g',roleId:'old',status:'active',role:{id:'old',key:'old',tenantId:'t',status:'active',menuPermissions:['workbench'],buttonPermissions:['knowledge.edit'],dataScope:'group'}}],projectMemberships:[{id:'pm',accountId:'owner',researchProjectId:'p',status:'active',roleKey:'researcher'}]});

test('fixture_clones_role_permissions_without_mutating_original',()=>{
  const input=base(),before=structuredClone(input);const plan=planStudyTaskFixture(input,'rh-s08-aabbccdd');
  assert.deepEqual(plan.roles[0].buttonPermissions,['knowledge.edit','study.execute']);
  assert.deepEqual(plan.roles[1].buttonPermissions,['knowledge.edit','study.configure','study.execute','study.review']);
  assert.equal(plan.roles[0].dataScope,'group');assert.deepEqual(input,before);
  assert.equal(plan.maxTasks,8);assert.equal(plan.taskNames.length,2);
});
test('fixture_rerun_does_not_expand_scope',()=>{
  const plan=planStudyTaskFixture(base(),'rh-s08-aabbccdd');
  const actual={scope:plan.scope,roleIds:plan.roles.map(r=>r.id),projectId:plan.project.id,taskIds:['task-a','task-b'],tasksCreated:2,adminEnabled:true,ownerRoleId:plan.roles[1].id,featureEnabled:true};
  assert.equal(validateStudyTaskFixture(plan,actual),true);
  assert.throws(()=>validateStudyTaskFixture(plan,{...actual,tasksCreated:9}),/S08_FIXTURE_STATE_CHANGED/);
  assert.throws(()=>validateStudyTaskFixture(plan,{...actual,roleIds:[...actual.roleIds,'unexpected']}),/S08_FIXTURE_STATE_CHANGED/);
  assert.throws(()=>validateStudyTaskFixture(plan,{...actual,scope:{...actual.scope,researchProjectId:'other'}}),/S08_FIXTURE_STATE_CHANGED/);
  assert.throws(()=>validateStudyTaskFixture(plan,{...actual,adminEnabled:false}),/S08_FIXTURE_STATE_CHANGED/);
});
test('fixture_refuses_missing_source_membership_and_untrusted_run_id',()=>{
  assert.throws(()=>planStudyTaskFixture({...base(),groupMemberships:[]},'rh-s08-aabbccdd'),/S08_FIXTURE_SOURCE_REJECTED/);
  assert.throws(()=>planStudyTaskFixture(base(),'wrong/path'),/S08_FIXTURE_RUN_REJECTED/);
});
test('fixture_rejects_tampered_manifest_before_reusing_it',()=>{
  const source=base(),plan=planStudyTaskFixture(source,'rh-s08-aabbccdd');
  const manifest={purpose:'ResearchHub-S08-20261102-task-page',syntheticOnly:true,plan};
  assert.doesNotThrow(()=>assertStudyTaskFixtureBoundary(manifest,source));
  assert.throws(()=>assertStudyTaskFixtureBoundary({...manifest,plan:{...plan,scope:{...plan.scope,tenantId:'foreign'}}},source),/S08_FIXTURE_BOUNDARY_REJECTED/);
  assert.throws(()=>assertStudyTaskFixtureBoundary({...manifest,plan:{...plan,ids:{...plan.ids,admin:'other'}}},source),/S08_FIXTURE_BOUNDARY_REJECTED/);
});
