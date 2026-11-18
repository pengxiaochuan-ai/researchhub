import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {editablePlanContent} from './research-plan-contract.mjs';
const api=await import('./guidance-plan-citation-contract.mjs').catch(()=>({}));
const sha=s=>createHash('sha256').update(s).digest('hex');
const source={documentId:'rhed-'+ 'a'.repeat(40),extractionId:'rhge-'+ 'b'.repeat(40),sourceSha256:'c'.repeat(64),payloadSha256:'d'.repeat(64)};
const input=()=>({baseVersionNo:1,requestKey:'citation-case-1',action:'add',target:{start:0,end:4,sha256:sha('方案段落')},source:{...source},clauseId:'clause-1',purpose:'design_check',confirmed:true});

test('paragraph offsets preserve CRLF and UTF-16 emoji rather than normalizing or guessing duplicate text',()=>{
 assert.equal(typeof api.planParagraphs,'function');
 const text='首😀段\r\n继续\r\n\r\n相同\n\n相同';
 assert.deepEqual(api.planParagraphs(text),[
  {start:0,end:8,text:'首😀段\r\n继续',sha256:sha('首😀段\r\n继续')},
  {start:12,end:14,text:'相同',sha256:sha('相同')},
  {start:16,end:18,text:'相同',sha256:sha('相同')},
 ]);
});
test('empty bodies have no targets and provenance is removed only by the existing editable-body function',()=>{
 assert.equal(typeof api.planParagraphs,'function');
 assert.deepEqual(api.planParagraphs(' \r\n\r\n '),[]);
 const raw='正文\n\n<!-- rh-plan-provenance -->\n\n## 来源与确认记录\n\n仅限合成研究候选；来源快照不代表正式方法学确认。\n\n私有来源尾注\n\n上下文SHA256：'+'a'.repeat(64)+'\n<!-- /rh-plan-provenance -->';
 assert.deepEqual(api.planParagraphs(editablePlanContent(raw)).map(p=>p.text),['正文']);
 assert.throws(()=>api.planParagraphs(raw));
 assert.equal(api.planParagraphs('\n 前导空行和空格')[0].text,'\n 前导空行和空格');
});
test('strict add/remove contracts reject untrusted source text and pages at every object level',()=>{
 assert.equal(typeof api.validateCitationInput,'function');
 assert.deepEqual(api.validateCitationInput(input()),input());
 assert.deepEqual(api.validateCitationInput({baseVersionNo:2,requestKey:'remove-case-1',action:'remove',citationId:'gc-'+ 'e'.repeat(32)}),{baseVersionNo:2,requestKey:'remove-case-1',action:'remove',citationId:'gc-'+ 'e'.repeat(32)});
 for(const bad of [{...input(),quote:'伪造原文'},{...input(),source:{...source,page:8}},{...input(),target:{...input().target,text:'伪造段落'}},{...input(),confirmed:false},{...input(),purpose:'ai_retrieval'},{...input(),baseVersionNo:0},{...input(),requestKey:'short'},{...input(),clauseId:'clause-99'},{...input(),source:{...source,payloadSha256:'D'.repeat(64)}}])assert.throws(()=>api.validateCitationInput(bad));
});
test('target matching requires the full original paragraph at the exact saved position and hash',()=>{
 assert.equal(typeof api.citationTargetState,'function');
 const target={start:0,end:4,sha256:sha('方案段落')};
 assert.equal(api.citationTargetState({target},'方案段落\n\n后续内容'),'matched');
 for(const [ref,text]of [[{target},'新增\n\n方案段落'],[{target},'方案变更'],[{target:{...target,start:1}},'方案段落'],[{target:{...target,sha256:'0'.repeat(64)}},'方案段落'],[{target:{start:0,end:2,sha256:sha('方案')}},'方案段落']])assert.equal(api.citationTargetState(ref,text),'changed');
});
test('duplicate citation and the thirteenth relationship are refused without dropping existing references',()=>{
 assert.equal(typeof api.assertCitationAddition,'function');
 const i=input(),ref={target:i.target,source:i.source,clauseId:i.clauseId,purpose:i.purpose};
 assert.doesNotThrow(()=>api.assertCitationAddition([],i));
 assert.throws(()=>api.assertCitationAddition([ref],i),/DUPLICATE/);
 assert.throws(()=>api.assertCitationAddition(Array.from({length:12},(_,n)=>({...ref,clauseId:'other-'+n})),i),/LIMIT/);
});
test('a JSON array cannot masquerade as a string clause identifier through RegExp coercion',()=>{
 assert.throws(()=>api.validateCitationInput({...input(),clauseId:['clause-1']}),/INPUT_INVALID/);
});
