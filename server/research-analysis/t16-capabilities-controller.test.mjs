import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createResearchStudiesController} from '../research-studies/controller.mjs';
const require = createRequire(new URL('../../../app/server/package.json', import.meta.url));
require('reflect-metadata');
class UnusedCore {
 executeHubTaskCommandInTransaction() {} enrollInTransaction() {}
 fixedReferenceStatusInTransaction(){throw Error('unused');}
 createProtocolVersionInTransaction(){throw Error('unused');}
}

test('capabilities GET route dispatches only the dedicated read metadata service and disables caching', async () => {
  const calls = [], expected = {studyId: 'study', runId: 'run', status: 'cancelled', reviewStatus: 'pending_review', capabilities: {canReview: false, canCancel: true}};
  const Controller = createResearchStudiesController({require, load: () => UnusedCore, formAdapter:{load:()=>UnusedCore,policy:{}}, prisma: {withTenantTransaction: () => {throw Error('unused');}}, scope: {product: 'researchhub', allowedTenantIds: ['tenant']}, origin: 'http://127.0.0.1:19501', createAnalysisServices: () => ({analysis: {}, runs: {capabilities: async (...args) => {calls.push(args); return expected;}}})});
  const method = Controller.prototype.analysisRunCapabilities;
  assert.equal(typeof method, 'function');
  assert.equal(Reflect.getMetadata('path', method), 'research-studies/:id/analysis/runs/:runId/capabilities');
  assert.equal(Reflect.getMetadata('method', method), 0);
  const headers = {}, user = {tenantId: 'tenant', accountId: 'actor'};
  const result = await new Controller().analysisRunCapabilities({user}, {setHeader: (name, value) => {headers[name] = value;}}, undefined, {id: 'study', runId: 'run'}, {});
  assert.deepEqual(result, expected); assert.deepEqual(calls, [[user, 'study', 'run']]); assert.equal(headers['Cache-Control'], 'no-store');
  await assert.rejects(new Controller().analysisRunCapabilities({user}, {setHeader: () => {}}, undefined, {id: 'study', runId: 'run'}, {role: 'tenant_admin'}), error => error.getStatus() === 400);
  assert.equal(calls.length, 1);
});
