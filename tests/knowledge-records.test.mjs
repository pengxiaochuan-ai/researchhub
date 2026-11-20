import test from 'node:test';
import assert from 'node:assert/strict';
import {knowledgeRecordTemplate,knowledgeDocumentSource,knowledgeRecordLinks,adoptKnowledgeAnswer,appendKnowledgeAnswer} from '../src/knowledge-records.js';
const scope={studyGroupId:'group',researchProjectId:'project'},hash='a'.repeat(64);
test('ordinary documents stay empty and three templates carry editable prompts without invented guidance',()=>{
 assert.equal(knowledgeRecordTemplate('document'),'');
 for(const [kind,parts] of [['reading',['原资料','要点','本人思考']],['idea',['问题','证据','后续行动']],['guidance',['指导人','日期','关联研究','讨论要点','后续行动']]]){
  const md=knowledgeRecordTemplate(kind);for(const part of parts)assert(md.includes(part));assert(!md.includes('已确认'));assert(!md.includes('已回复'));
 }
 assert.throws(()=>knowledgeRecordTemplate('unknown'));
});
test('source links bind actual authorized document version and hash, with no latest fallback',async()=>{
 const source=await knowledgeDocumentSource({id:'doc',kbId:'kb',version:2,title:'原[材料]',contentMd:'source'},scope);
 assert(source.href.includes('docVersion=2'));const links=knowledgeRecordLinks(knowledgeRecordTemplate('reading',source),scope);
 assert.equal(links.length,1);assert.equal(links[0].href,source.href);
 assert.equal(knowledgeRecordLinks(`[bad](https://example.test)\n[bad](/pages/k01/?docId=doc)`,scope).length,0);
 assert.equal(knowledgeRecordLinks(`[bad](${source.href})`,{...scope,researchProjectId:'foreign'}).length,0);
 await assert.rejects(()=>knowledgeDocumentSource({id:'doc',kbId:'kb',version:0,contentMd:''},scope));
});
const source={docId:'doc',kbId:'kb',docTitle:'来源',kbName:'本人库',version:1,contentHash:hash,chunkId:'chunk',quote:'fragment',retrievedAt:'2026-11-20T01:00:00Z'};
const message={id:'answer',role:'assistant',content:'已有回答 [1]\n![image](https://external.test/a)\n<img src="https://external.test/b">',meta:{sourceStatus:'current',provenance:{knowledgeSources:[source]}}};
function getter({stale=false,changed=false,revoked=false}={}){const calls=[];return {calls,get:async path=>{calls.push(path);if(path.includes('knowledge-state'))return{hubContext:{kind:'knowledge',kbId:'kb'},messages:[{...message,content:changed?'changed':message.content,meta:{...message.meta,sourceStatus:stale?'stale':'current'}}]};if(revoked)throw Error('forbidden');return{...source,status:'current'};}};}
test('explicit adoption re-reads real conversation and every current fixed source, only appends safe draft text',async()=>{
 const api=getter(),adopted=await adoptKnowledgeAnswer({get:api.get,sessionId:'session',kbId:'kb',message,scope});assert.equal(api.calls.length,2);assert(adopted.includes('docVersion=1'));assert(adopted.includes('contentSha256='+hash));assert(!adopted.includes('![image]'));assert(!/(^|[^\\])<img/.test(adopted));assert(!adopted.includes('https://external.test'));
 const original='本人的未保存文字  \n';assert(appendKnowledgeAnswer(original,adopted).startsWith(original));assert(appendKnowledgeAnswer(original,adopted).includes('AI整理草稿'));
});
test('stale, changed, revoked or foreign answers cannot enter a new draft',async()=>{
 for(const config of [{stale:true},{changed:true},{revoked:true}]){const api=getter(config);await assert.rejects(()=>adoptKnowledgeAnswer({get:api.get,sessionId:'session',kbId:'kb',message,scope}));}
 await assert.rejects(()=>adoptKnowledgeAnswer({get:getter().get,sessionId:'session',kbId:'foreign',message,scope}));
});

test('oversized adoption never changes the input draft, and source hashes are checked again',async()=>{
 const draft='x'.repeat(131072);assert.throws(()=>appendKnowledgeAnswer(draft,'extra'));assert.equal(draft.length,131072);
 const api=getter();await assert.rejects(()=>adoptKnowledgeAnswer({get:async path=>{const value=await api.get(path);return path.includes('knowledge-sources')?{...value,contentHash:'b'.repeat(64)}:value;},sessionId:'session',kbId:'kb',message,scope}));
});
