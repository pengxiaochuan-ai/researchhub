import test from 'node:test';import assert from 'node:assert/strict';
import {validateCommentInput,commentTransition,presentAssetComments} from './research-assets-comments.mjs';
const p={accountId:'owner',isTenantAdmin:false},input={action:'create',body:'<script>不会执行</script>\n请核对来源',expectedRevision:9,identityRevision:'a'.repeat(64),contentHash:'b'.repeat(64),policyHash:'c'.repeat(64),requestKey:'comment-request-key'};
test('comments preserve plain text, reject hidden fields, empty input and malformed CAS',()=>{
 assert.equal(validateCommentInput(input).body,input.body);for(const extra of [{body:' '},{body:'x'.repeat(2001)},{storageKey:'x'},{expectedRevision:0},{parentCommentId:'../secret'}])assert.throws(()=>validateCommentInput({...input,...extra}));
});
test('author revisions use CAS and withdrawal hides body; administrator moderation requires a reason and cannot impersonate edit/withdraw',()=>{
 const c={commentId:'comment1',authorAccountId:'owner',action:'create',body:'原文',revision:1,parentCommentId:null},edit={...input,action:'edit',expectedCommentRevision:1,body:'修订'};
 assert.equal(commentTransition(c,edit,p).revision,2);assert.throws(()=>commentTransition(c,{...edit,expectedCommentRevision:2},p));assert.throws(()=>commentTransition(c,edit,{accountId:'admin',isTenantAdmin:true}));
 assert.throws(()=>commentTransition(c,{...edit,action:'withdraw',body:''},{accountId:'admin',isTenantAdmin:true}));assert.throws(()=>commentTransition(c,{...edit,action:'moderate',body:'',reason:''},{accountId:'admin',isTenantAdmin:true}));
 assert.equal(commentTransition(c,{...edit,action:'moderate',body:'',reason:'来源讨论需人工核对'},{accountId:'admin',isTenantAdmin:true}).body,'');
 assert.throws(()=>commentTransition({...c,action:'withdraw'},edit,p));assert.throws(()=>commentTransition({...c,revision:3},{...edit,expectedCommentRevision:3},p));
});
test('withdrawn projections keep author/parent and real timing without disclosing previous body or raw audit',()=>{
 const x=presentAssetComments([{comment_id:'comment1',author_account_id:'owner',actor_account_id:'owner',author_name:'科研人员',action:'withdraw',revision:2,body:'',parent_comment_id:null,created_at:new Date(),event_revision:10}],{accountId:'owner',isTenantAdmin:false},true);assert.equal(x[0].body,'');assert.equal(x[0].state,'withdrawn');assert.equal(x[0].canEdit,false);assert(!JSON.stringify(x).includes('request_hash'));
});
test('comment state follows immutable revision order even when transaction timestamps or UUID ordering put the older row last',async()=>{
 const {latestAssetComments}=await import('./research-assets-comments.mjs');assert.equal(typeof latestAssetComments,'function');const root={comment_id:'c1',revision:1,action:'create',body:'旧正文',created_at:new Date('2026-11-13T00:00:01Z')},edited={...root,revision:2,action:'edit',body:'新正文',created_at:new Date('2026-11-13T00:00:00Z')};const [row]=latestAssetComments([edited,root]);assert.equal(row.revision,2);assert.equal(row.body,'新正文');assert.equal(row.first_at,root.created_at);
});
