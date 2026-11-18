import assert from'node:assert/strict';
export function validateMediaIngestScope(c,ids,{checkpoint,registered}){
 const ok=value=>assert(value,'MEDIA_INGEST_SCOPE_REJECTED');
 ok(c?.schema==='hub-media-binding-scope.v1'&&c.scopeKey==='media-bind-20261116'&&c.tenantId===ids.tenant&&c.source?.studyGroupId===ids.group&&c.source.researchProjectId===ids.project);
 ok(c.target?.studyId==='rh-study-b3fa8c8d-b861-454e-8733-5ccbcce8f090'&&c.target.studyGroupId===ids.group&&c.target.executionProjectId==='cmwcc7ft60002lua6zkvh0mxj');
 ok(checkpoint?.scope==='media-origin-two-synthetic-20261116'&&Object.keys(c.actors??{}).sort().join(',')==='admin,owner');
 for(const key of ['owner','admin']){const a=c.actors[key],original=checkpoint.actors[key],objects=registered?.[ids[key]];ok(a.accountId===ids[key]&&a.sessionId===original.sessionId&&a.mediaId===original.mediaId&&original.completed===true&&objects?.subjectIds.includes(a.subjectId));ok(!a.visit||objects.visitIds.includes(a.visit.id)&&a.visit.subjectId===a.subjectId);ok(/^[a-f0-9]{64}$/.test(a.sha256)&&Number.isSafeInteger(a.byteSize)&&a.byteSize>0&&a.byteSize<=500*1024*1024);}
 return c;
}
