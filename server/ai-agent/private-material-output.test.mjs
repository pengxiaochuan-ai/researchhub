import test from 'node:test';import assert from 'node:assert/strict';
import {materialDigest} from './session-material-contract.mjs';
const api=await import('./private-material-output.mjs').catch(()=>({}));
const bindingBody={schema:'hub-private-materials.v1',principal:{tenantId:'tenant',accountId:'owner',studyGroupId:'group',researchProjectId:'project'},sessionId:'session',materials:[{materialId:'material',version:3,kbId:'kb',sourceFileId:'file',sourceSha256:'a'.repeat(64),docId:'doc',docVersion:1,contentSha256:'b'.repeat(64)}]};
const packBody={schema:'hub-private-material-pack.v1',binding:{...bindingBody,hash:materialDigest(bindingBody)},readingLimit:24000,sources:[{id:'M1',materialId:'material',docId:'doc',kbId:'kb',title:'本人合成科研资料',reviewed:false,sourceType:'owner-uploaded-draft',coverage:{complete:false,readCharacters:500,totalCharacters:9000,totalLines:100,positionUnit:'unicode-codepoints'},fragments:[{id:'M1-F1',start:0,end:100,lineStart:1,lineEnd:5,text:'Synthetic study material. The primary outcome showed no significant difference between groups. IL-17 was measured.'}]}]};
const pack={...packBody,packHash:materialDigest(packBody)};
const response={sections:[{kind:'fact',text:'原文报告主要结局没有显著组间差异。',fragmentIds:['M1-F1']},{kind:'inference',text:'后续可核对不同测量方法的适用性。',fragmentIds:['M1-F1']}]};
test('private synthesis input carries exact selected fragments and owner draft/partial coverage without arbitrary tools',()=>{
 assert.equal(typeof api.privateMaterialInput,'function');const input=JSON.parse(api.privateMaterialInput('总结本次资料并说明局限',pack));
 assert.equal(input.sources[0].sourceType,'owner-uploaded-draft');assert.equal(input.sources[0].coverage.complete,false);assert.equal(input.sources[0].fragments[0].text,pack.sources[0].fragments[0].text);assert(!JSON.stringify(input).includes('storageKey'));
 assert.equal(input.question,'总结本次资料并说明局限');assert(api.PRIVATE_MATERIAL_INSTRUCTION.includes('不计算'));
});
test('backend renders real citations and separates reported facts from AI inferences',()=>{
 const accepted=api.acceptPrivateMaterialOutput(JSON.stringify(response),pack);
 assert.match(accepted.text,/原文报告/);assert.match(accepted.text,/AI推论/);assert.match(accepted.text,/\[1\]/);assert.match(accepted.text,/未全文逐字审阅/);
 assert.equal(api.verifyPrivateMaterialOutput(accepted.validation,pack,accepted.text).text,accepted.text);
 assert.throws(()=>api.verifyPrivateMaterialOutput(accepted.validation,pack,accepted.text+' changed'));
});
test('a mixed numeric sentence does not erase independent qualitative explanation or deliver a fabricated result',()=>{
 const accepted=api.acceptPrivateMaterialOutput(JSON.stringify({sections:[{kind:'fact',text:'材料讨论了IL-17。计算后的疗效为98.73%。',fragmentIds:['M1-F1']}]}),pack);
 assert.match(accepted.text,/材料讨论了IL-17/);assert(!accepted.text.includes('98.73'));assert.match(accepted.text,/数值/);
 assert.throws(()=>api.acceptPrivateMaterialOutput(JSON.stringify({sections:[{kind:'fact',text:'计算后的疗效为98.73%。',fragmentIds:['M1-F1']}]}),pack),/HUB_PRIVATE_NO_DELIVERABLE/);
});
test('forged/cross-pack references, model links and empty responses fail; known major-outcome contradiction is not delivered',()=>{
 for(const update of [{fragmentIds:['other-F1']},{text:'请打开https://untrusted.invalid/private'},{text:'<img src="https://untrusted.invalid/">'}])assert.throws(()=>api.acceptPrivateMaterialOutput(JSON.stringify({sections:[{...response.sections[0],...update}]}),pack));
 assert.throws(()=>api.acceptPrivateMaterialOutput('{}',pack));
 for(const kind of ['toString','__proto__',{},null])assert.throws(()=>api.acceptPrivateMaterialOutput(JSON.stringify({sections:[{...response.sections[0],kind}]}),pack),/HUB_PRIVATE_OUTPUT_INVALID/);
 const accepted=api.acceptPrivateMaterialOutput(JSON.stringify({sections:[{kind:'fact',text:'主要结局显著优于对照组。材料讨论了IL-17。',fragmentIds:['M1-F1']}]}),pack);
 assert(!accepted.text.includes('主要结局显著优于'));assert.match(accepted.text,/IL-17/);
});
test('reservation bound covers the exact UTF8 prompt and response, not only the short user question',()=>{
 const text=api.privateMaterialInput('总结本人材料',pack),n=api.privateMaterialReservationMaxTokens('实际方法与说明'.repeat(100),text,1536);
 assert(n>=1536);assert(n*8>=Buffer.byteLength('实际方法与说明'.repeat(100))+Buffer.byteLength(text)+1536);
 assert.throws(()=>api.privateMaterialReservationMaxTokens('instruction','text',Infinity));
});
test('a storage-validation note cannot establish statistical imputation/deletion rules or deny an explicit purpose',()=>{
 const body=structuredClone(packBody);body.sources[0].title='Synthetic research upload validation';body.sources[0].fragments[0].text='Synthetic research upload validation. Missing observations remain missing. Zero and false are observed values, not blanks. No treatment effect is claimed.';
 const p={...body,packHash:materialDigest(body)},raw={sections:[{kind:'inference',text:'缺失值规则暗示后续分析不进行均值填补或删除。零和假应与缺失值区分。材料未说明其用途、目标读者或验证标准。',fragmentIds:['M1-F1']}]};
 const a=api.acceptPrivateMaterialOutput(JSON.stringify(raw),p);assert(!a.text.includes('不进行均值填补或删除'));assert(!a.text.includes('材料未说明其用途'));assert(a.text.includes('零和假应与缺失值区分'));assert(a.text.includes('按研究方案确认'));assert.equal(a.validation.policy,'hub-private-claims.v2');
 assert.equal(api.verifyPrivateMaterialOutput(a.validation,p,a.text).text,a.text);
 // Legacy text/receipt and billing remain verifiable; current projection may
 // show a corrected view without silently rewriting that historical record.
 const text='基于本次固定选段，未全文逐字审阅；未选入的部分不在本次分析范围。\n\n### AI推论（尚待验证）\n\n'+raw.sections[0].text+' [1]';
 const legacy={schema:'hub-private-output.v1',packHash:p.packHash,response:raw,sections:[{kind:'inference',fragmentIds:['M1-F1'],issues:[],delivered:true}],textHash:materialDigest(text)};
 assert.equal(api.verifyPrivateMaterialOutput(legacy,p,text).text,text);
 const storage=api.acceptPrivateMaterialOutput(JSON.stringify({sections:[{kind:'fact',text:'缺失观测值保持缺失，不进行填补或推断。',fragmentIds:['M1-F1']}]}),p);assert(storage.text.includes('缺失观测值保持缺失，不进行填补或推断。'));
});
