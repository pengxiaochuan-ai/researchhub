import test from 'node:test';
import assert from 'node:assert/strict';

const module=await import('./r1-task-fixtures.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
const build=module.buildR1TaskFixtureRows??(()=>assert.fail('D01受保护任务构造尚未实现'));
const validate=module.validateR1FixtureRows??(()=>assert.fail('D01精确两条边界校验尚未实现'));
const run='rh-r1-20261102-a1b2c3d4';

test('D01只构造固定Study的两个本人手工任务，不带临床父对象',()=>{
 const rows=build(run);
 assert.equal(rows.length,2);
 assert.deepEqual(rows.map(r=>[r.id,r.assigneeAccountId,r.status]),[
  [run+'-owner-task','rh-kb-local-b0e2af9d-owner','open'],
  [run+'-admin-task','rh-kb-local-b0e2af9d-admin','completed']
 ]);
 for(const r of rows){
  assert.equal(r.tenantId,'rh-kb-local-b0e2af9d-tenant');assert.equal(r.studyGroupId,'rh-kb-local-b0e2af9d-group');assert.equal(r.researchProjectId,'rh-kb-local-b0e2af9d-project');
  assert.equal(r.createdBy,r.assigneeAccountId);assert.equal(r.source,'manual');assert.equal(r.taskType,'custom');assert.equal(r.acceptanceFixture,false);
  assert(r.name.includes('合成只读验收'));assert(!Object.hasOwn(r,'subjectId'));assert(!Object.hasOwn(r,'collaborators'));assert(!Object.hasOwn(r,'enrollmentId'));
 }
 assert.equal(validate(run,rows),true);
});

test('D01拒绝非本轮命名空间，不能生成新一批任意ID',()=>{
 for(const value of ['',null,'old-run-12345678','rh-r1-20261102-a1b2c3d4-extra','rh-r1-20261103-a1b2c3d4'])assert.throws(()=>build(value),/R1_FIXTURE_RUN_REJECTED/);
});

test('D01拒绝多于两条及同账号重复，不可能扩成批量任务',()=>{
 const rows=build(run);assert.throws(()=>validate(run,[...rows,rows[0]]),/R1_FIXTURE_ROWS_REJECTED/);
 assert.throws(()=>validate(run,[rows[0],rows[0]]),/R1_FIXTURE_ROWS_REJECTED/);
});

test('D01跨Study、换受派人、临床父对象与额外写字段均拒绝',()=>{
 for(const delta of [{studyGroupId:'other'},{researchProjectId:'other'},{assigneeAccountId:'rh-kb-local-b0e2af9d-admin'},{subjectId:'synthetic-subject'},{priority:'urgent'},{acceptanceFixture:true},{version:1}]){
  const rows=build(run);assert.throws(()=>validate(run,[{...rows[0],...delta},rows[1]]),/R1_FIXTURE_ROWS_REJECTED/);
 }
});

test('D01已保存具名行可重读；不允许用既有ID覆盖不同内容',()=>{
 const rows=build(run);assert.equal(validate(run,JSON.parse(JSON.stringify(rows))),true);
 assert.throws(()=>validate(run,[{...rows[0],name:'替换已有任务'},rows[1]]),/R1_FIXTURE_ROWS_REJECTED/);
});
