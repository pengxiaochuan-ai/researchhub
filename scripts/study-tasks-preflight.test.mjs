import assert from 'node:assert/strict';
import test from 'node:test';

// Each expectation is hand-derived from the old feature/Study/permission gates.
const load = () => import('./study-tasks-preflight.mjs');
const snapshot = () => ({
  databaseName: 'wp01_test_full_baseline', syntheticOnly: true,
  scope: {tenantId:'t',studyGroupId:'g',researchProjectId:'p'},
  ids: {owner:'owner',admin:'admin'}, featureEnabled:false,
  accounts:[{id:'owner',tenantId:'t',status:'active',isTenantAdmin:false},{id:'admin',tenantId:'t',status:'active',isTenantAdmin:false}],
  groupMemberships:[{accountId:'owner',studyGroupId:'g',status:'active',studyGroup:{status:'active'},role:{status:'active',menuPermissions:['workbench'],buttonPermissions:[]}}],
  projectMemberships:[{accountId:'owner',studyGroupId:'g',researchProjectId:'p',status:'active',roleKey:'researcher',researchProject:{status:'active'}}],
});

test('preflight_refuses_other_project_write_gain', async () => {
  const {evaluateStudyTaskAdmission} = await load(); const input=snapshot();
  input.projectMemberships.push({accountId:'owner',studyGroupId:'g',researchProjectId:'other',status:'active',roleKey:'researcher',researchProject:{status:'active'}});
  const result=evaluateStudyTaskAdmission(input);
  assert.equal(result.allowed,false);
  assert.deepEqual(result.outsideWriteGains,[{accountId:'owner',researchProjectId:'other',permissions:['study.execute']}]);
});

test('preflight_rejects_wrong_database', async () => {
  const {evaluateStudyTaskAdmission} = await load(); const input=snapshot(); input.databaseName='clinical';
  assert.throws(()=>evaluateStudyTaskAdmission(input),/S08_TARGET_REJECTED/);
});

test('preflight_rejects_missing_synthetic_marker_and_foreign_account', async () => {
  const {evaluateStudyTaskAdmission} = await load(); const input=snapshot(); input.syntheticOnly=false;
  assert.throws(()=>evaluateStudyTaskAdmission(input),/S08_TARGET_REJECTED/);
  input.syntheticOnly=true; input.accounts[0].tenantId='other';
  assert.throws(()=>evaluateStudyTaskAdmission(input),/S08_ACCOUNT_REJECTED/);
});

test('preflight_allows_main_scope_and_preserves_input', async () => {
  const {evaluateStudyTaskAdmission} = await load(); const input=snapshot(); const before=structuredClone(input);
  assert.deepEqual(evaluateStudyTaskAdmission(input),{allowed:true,outsideWriteGains:[]});
  assert.deepEqual(input,before);
});

test('preflight_checks_project_manager_governance_permissions', async () => {
  const {evaluateStudyTaskAdmission} = await load(); const input=snapshot();
  input.projectMemberships.push({accountId:'owner',studyGroupId:'g',researchProjectId:'other',status:'active',roleKey:'project_manager',researchProject:{status:'active'}});
  assert.deepEqual(evaluateStudyTaskAdmission(input).outsideWriteGains[0].permissions,['study.configure','study.execute','study.review']);
});

test('preflight_feature_activation_can_grant_existing_role_permissions_in_another_group', async () => {
  const {evaluateStudyTaskAdmission} = await load(); const input=snapshot();
  input.groupMemberships.push({accountId:'owner',studyGroupId:'g2',status:'active',studyGroup:{status:'active'},role:{status:'active',menuPermissions:['workbench'],buttonPermissions:['study.execute']}});
  input.projectMemberships.push({accountId:'owner',studyGroupId:'g2',researchProjectId:'other',status:'active',roleKey:'researcher',researchProject:{status:'active'}});
  assert.equal(evaluateStudyTaskAdmission(input).allowed,false);
  input.featureEnabled=true;
  assert.equal(evaluateStudyTaskAdmission(input).allowed,true);
});

test('preflight_inactive_project_member_group_or_role_does_not_gain_write', async () => {
  const {evaluateStudyTaskAdmission} = await load();
  for(const kind of ['member','project','group','role']){
    const input=snapshot(); const row={accountId:'owner',studyGroupId:'g',researchProjectId:'other',status:'active',roleKey:'researcher',researchProject:{status:'active'}};
    input.projectMemberships.push(row);
    if(kind==='member')row.status='inactive'; if(kind==='project')row.researchProject.status='archived';
    if(kind==='group')input.groupMemberships[0].studyGroup.status='inactive'; if(kind==='role')input.groupMemberships[0].role.status='inactive';
    assert.equal(evaluateStudyTaskAdmission(input).allowed,true,kind);
  }
});
