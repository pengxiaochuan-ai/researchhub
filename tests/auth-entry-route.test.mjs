import test from 'node:test';
import assert from 'node:assert/strict';
import { safeAuthenticatedReturnTo } from '../src/route-context.js';

test('fresh authenticated entry defaults to my research and rejects external or demo destinations', () => {
  assert.equal(safeAuthenticatedReturnTo(null), '/pages/p01/');
  assert.equal(safeAuthenticatedReturnTo('https://other.example/pages/p01/'), '/pages/p01/');
  assert.equal(safeAuthenticatedReturnTo('//other.example/pages/p01/'), '/pages/p01/');
  assert.equal(safeAuthenticatedReturnTo('/pages/h01/'), '/pages/p01/');
  assert.equal(safeAuthenticatedReturnTo('/pages/q02/'), '/pages/q02/');
});

test('authenticated returnTo keeps only explicit real workspace scope and strips tokens', () => {
  assert.equal(safeAuthenticatedReturnTo('/pages/q02/?designWorkspace=1&studyGroupId=g1&researchProjectId=p1'), '/pages/q02/?designWorkspace=1&studyGroupId=g1&researchProjectId=p1');
  assert.equal(safeAuthenticatedReturnTo('/pages/q02/?designWorkspace=1&studyGroupId=g1&researchProjectId=p1&token=secret'), '/pages/p01/');
  assert.equal(safeAuthenticatedReturnTo('/pages/p01/#token=secret'), '/pages/p01/');
  assert.equal(safeAuthenticatedReturnTo('/pages/k01/?returnTo=%2F%2Fevil.example'), '/pages/p01/');
});
test('expired personal profile, knowledge governance and scoped design return to their original allowed leaf',()=>{for(const path of ['/pages/p006/','/pages/k01/?mode=manage','/pages/s08/?studyGroupId=g&researchProjectId=p&taskId=t','/pages/q02/?designWorkspace=1&studyGroupId=g&researchProjectId=p&researchPlanId=plan'])assert.equal(safeAuthenticatedReturnTo(path),path);for(const path of ['/pages/k01/?mode=other','/pages/k01/?mode=manage&token=secret'])assert.equal(safeAuthenticatedReturnTo(path),'/pages/p01/');});
