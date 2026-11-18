// Revalidate the two already-paid responses offline. No provider/HTTP/DB calls.
import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
import {acceptPrivateMaterialOutput,verifyPrivateMaterialOutput} from '../server/ai-agent/private-material-output.mjs';
const out='.tmp/ai-file-data-2026-11-12/p03-real-approved-2026-11-13',results=[];
for(const actor of ['owner','admin']){
 const state=JSON.parse(readFileSync(out+'/'+actor+'-state.json','utf8')),message=state.messages.find(m=>m.role==='assistant'),p=message.meta.provenance,pack=p.privateMaterialEvidence;
 verifyPrivateMaterialOutput(p.privateMaterialOutput,pack,message.content);
 const next=acceptPrivateMaterialOutput(JSON.stringify(p.privateMaterialOutput.response),pack);
 assert(!next.text.includes('不进行均值填补或删除'));assert(!next.text.includes('材料未说明其用途'));assert(!next.text.includes('材料本身未明确说明目的'));
 for(const text of ['缺失','零','治疗效果'])assert(next.text.includes(text));
 if(actor==='admin'){assert(next.text.includes('按研究方案确认'));assert(next.text.includes('材料已给出上传验证用途'));}
 const result={actor,messageId:message.id,policy:next.validation.policy,packHash:pack.packHash,originalReceiptVerified:true,changed:next.text!==message.content,text:next.text,issues:next.validation.sections.map(s=>s.issues),modelCalls:0};
 writeFileSync(out+'/'+actor+'-corrected-view.json',JSON.stringify(result,null,2),{mode:0o600});results.push({actor,changed:result.changed,policy:result.policy});
}
console.log(JSON.stringify({passed:true,modelCalls:0,originalResponsesPreserved:true,results}));
