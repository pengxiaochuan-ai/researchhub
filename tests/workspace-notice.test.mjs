import test from 'node:test';
import assert from 'node:assert/strict';
import {showWorkspaceNotice} from '../src/workspace-notice.js';

test('normal real pages do not show generic developer notices',()=>{
 for(const id of ['p01','k01','q02','a01','ai01','e01','e02','h01','h05','c01','c03','h06','g02','s11','p002'])assert.equal(showWorkspaceNotice(id,'','live'),false,id);
});
test('explicit demo keeps a visible demo label, except the existing governance leaf exclusion',()=>{
 assert.equal(showWorkspaceNotice('ai01','','demo'),true);assert.equal(showWorkspaceNotice('q01','','demo'),true);
 assert.equal(showWorkspaceNotice('g02','?view=directory-review','demo'),false);
});
test('synthetic and private candidate branches retain their existing notice and navigation container',()=>{
 for(const[id,search]of [['q01','?researchPlanId=valid'],['s11','?executionPreparation=1'],['s03','?syntheticCapture=1'],['s06','?crfMethods=1'],['a01','?assetDrafts=1'],['a02','?crfMethodAssets=1'],['a02','?assetApplicability=1'],['s07','?designWorkspace=1']])assert.equal(showWorkspaceNotice(id,search,'live'),true,id+search);
});
