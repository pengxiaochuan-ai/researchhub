import test from 'node:test';import assert from 'node:assert/strict';
const view=await import('../src/session-material-session.js').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return null;throw e;});
test('knowledge deep link binds the exact document, library and authorized scope',()=>{
 assert.ok(view,'material view contract is missing');
 const target={studyGroupId:'group',researchProjectId:'project',kbId:'base',docId:'doc'};
 const href=view.materialKnowledgeHref({available:true,kbId:'base',docId:'doc'},target);
 assert.equal(href,'/pages/k01/?studyGroupId=group&researchProjectId=project&kbId=base&docId=doc');
 assert.deepEqual(view.readMaterialKnowledgeTarget(href.split('?')[1]),{kind:'valid',...target});
 assert.equal(view.readMaterialKnowledgeTarget('?kbId=base&docId=doc').kind,'invalid');
 assert.equal(view.readMaterialKnowledgeTarget('?mode=manage').kind,'none');
 assert.equal(view.readMaterialKnowledgeTarget('?studyGroupId=group&researchProjectId=project&kbId=base&docId=doc&docId=other').kind,'invalid');
 assert.equal(view.materialKnowledgeHref({available:false,kbId:'base',docId:'doc'},target),null);
});
test('pending upload recovery stores request keys only, never file contents or names',()=>{
 assert.ok(view,'material view contract is missing');
 assert.deepEqual(view.readPendingMaterialKeys('["key-one","key-one","key-two"]'),['key-one','key-two']);
 assert.deepEqual(view.readPendingMaterialKeys('[{"filename":"private.txt"}]'),[]);
 assert.deepEqual(view.readPendingMaterialKeys('bad-json'),[]);
 assert.deepEqual(view.readPendingMaterialKeys('["../other"]'),[]);
});
test('fixed evidence link carries both version and full text fingerprint; K01 rejects a changed revision',async()=>{
 const contentMd='synthetic source zero=0 false=false',bytes=new TextEncoder().encode(contentMd),contentSha256=Buffer.from(await crypto.subtle.digest('SHA-256',bytes)).toString('hex');
 const scope={studyGroupId:'group',researchProjectId:'project'},doc={id:'doc',kbId:'base',version:3,contentMd};
 const href=view.materialKnowledgeHref({available:true,kbId:'base',docId:'doc',docVersion:3,contentSha256},scope);
 assert(href.includes('docVersion=3')&&href.includes('contentSha256='+contentSha256));const target=view.readMaterialKnowledgeTarget(href.split('?')[1]);assert.equal(target.kind,'valid');
 assert.equal(await view.assertMaterialDocumentVersion(doc,target),true);
 await assert.rejects(view.assertMaterialDocumentVersion({...doc,version:4},target),/资料已修订/);
 await assert.rejects(view.assertMaterialDocumentVersion({...doc,contentMd:contentMd+' revised'},target),/资料已修订/);
 for(const suffix of ['&docVersion=4','&unknown=1'])assert.equal(view.readMaterialKnowledgeTarget(href.split('?')[1]+suffix).kind,'invalid');
 assert.equal(view.materialKnowledgeHref({available:true,kbId:'base',docId:'doc',docVersion:3},scope),null);
});
test('native import decision link has one exact task, library and scope, never a mixed document target',()=>{
 const scope={studyGroupId:'group',researchProjectId:'project'};
 const href=view.materialKnowledgeHref({state:'blocked',available:false,kbId:'base',decisionRequired:true,importTaskId:'task'},scope);
 assert.equal(href,'/pages/k01/?studyGroupId=group&researchProjectId=project&kbId=base&importTaskId=task');
 assert.deepEqual(view.readMaterialKnowledgeTarget(href.split('?')[1]),{kind:'valid',...scope,kbId:'base',importTaskId:'task'});
 assert.equal(view.readMaterialKnowledgeTarget(href.split('?')[1]+'&docId=doc').kind,'invalid');
 assert.equal(view.materialStateLabel({state:'blocked',stage:'discarded'}),'未保存');
 assert.equal(view.materialStateLabel({state:'blocked',decisionRequired:true}),'需要确认保存');
});
