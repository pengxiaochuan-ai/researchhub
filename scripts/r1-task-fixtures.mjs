// D01 fixture data only. No business endpoint, permission initializer or Worker.
import assert from 'node:assert/strict';

export function buildR1TaskFixtureRows(runId){
 assert(typeof runId==='string'&&/^rh-r1-20261102-[a-f0-9]{8}$/.test(runId),'R1_FIXTURE_RUN_REJECTED');
 return ['owner','admin'].map((actor,index)=>({
  id:runId+'-'+actor+'-task',tenantId:'rh-kb-local-b0e2af9d-tenant',
  studyGroupId:'rh-kb-local-b0e2af9d-group',researchProjectId:'rh-kb-local-b0e2af9d-project',
  assigneeAccountId:'rh-kb-local-b0e2af9d-'+actor,createdBy:'rh-kb-local-b0e2af9d-'+actor,
  source:'manual',taskType:'custom',name:'R1合成只读验收 · '+(index===0?'科研人员待处理':'管理员已完成'),
  status:index===0?'open':'completed',priority:'normal',acceptanceFixture:false,version:0,
  requiresReview:false,reviewStatus:'not_required',evidenceRefs:[]
 }));
}

export function validateR1FixtureRows(runId,rows){
 const expected=buildR1TaskFixtureRows(runId);
 try{assert.deepEqual(rows,expected);}catch{throw new Error('R1_FIXTURE_ROWS_REJECTED');}
 return true;
}
