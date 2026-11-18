import assert from 'node:assert/strict';
export function verifyInterruptedClose({job:j,reservation:r,ids,now,usage:u,trace:t}){
 assert.equal(j.id,'cmwcw7u280005luyi1na8t4wf');assert.equal(r.id,'cmwcw7utc0008luyicjlle5f9');
 assert.equal(j.tenantId,ids.tenant);assert.equal(j.accountId,ids.owner);assert.equal(j.studyGroupId,ids.group);assert.equal(j.researchProjectId,ids.project);
 assert.equal(j.status,'processing');assert.equal(j.assistantMessageId,null);assert(j.executionToken&&j.workerOwner);assert(j.leaseExpiresAt instanceof Date&&j.leaseExpiresAt<now);
 assert.equal(r.tenantId,j.tenantId);assert.equal(r.accountId,j.accountId);assert.equal(r.requestKey,`chat:${j.sessionId}:${j.requestKey}`);assert.equal(r.status,'active');assert.equal(r.reservedTokens,12288n);assert.equal(r.actualTokens,null);assert.equal(r.reconciliationUsageRecordId,null);
 assert.deepEqual([u?.promptTokens,u?.completionTokens,u?.totalTokens,u?.callCount,u?.model],[1803,470,2273,1,'deepseek-v4-pro']);
 assert.equal(t?.jobId,j.id);assert.equal(t.httpStatus,200);assert.equal(t.request?.model,u.model);assert.deepEqual([t.usage?.prompt_tokens,t.usage?.completion_tokens,t.usage?.total_tokens],[1803,470,2273]);
 return{actualTokens:2273,releasedTokens:10015};
}
