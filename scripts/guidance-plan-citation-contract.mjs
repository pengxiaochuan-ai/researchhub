import {createHash} from 'node:crypto';

export const citationHash=value=>createHash('sha256').update(value).digest('hex');
const fail=code=>{throw new Error(code);};
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&
 Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);

// Input is the existing editablePlanContent output. Never normalize its coordinates.
export function planParagraphs(contentMd){
 if(typeof contentMd!=='string'||contentMd.includes('<!-- rh-plan-provenance -->'))fail('CITATION_BODY_INVALID');
 const result=[],separators=/(?:\r?\n)[\t ]*(?:\r?\n)(?:[\t ]*(?:\r?\n))*/g;
 let start=0;
 const add=end=>{const text=contentMd.slice(start,end);if(text.trim())result.push({start,end,text,sha256:citationHash(text)});};
 for(const match of contentMd.matchAll(separators)){add(match.index);start=match.index+match[0].length;}
 add(contentMd.length);return result;
}
export function validateCitationInput(input){
 const add=input?.action==='add';
 if(!exact(input,add?['baseVersionNo','requestKey','action','target','source','clauseId','purpose','confirmed']:['baseVersionNo','requestKey','action','citationId'])||
  !Number.isSafeInteger(input.baseVersionNo)||input.baseVersionNo<1||typeof input.requestKey!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(input.requestKey))fail('CITATION_INPUT_INVALID');
 if(!add){if(input.action!=='remove'||typeof input.citationId!=='string'||!/^gc-[a-f0-9]{32}$/.test(input.citationId))fail('CITATION_INPUT_INVALID');return input;}
 const {target:t,source:s}=input;
 if(!exact(t,['start','end','sha256'])||!Number.isSafeInteger(t.start)||!Number.isSafeInteger(t.end)||t.start<0||t.end<=t.start||!hash(t.sha256)||
  !exact(s,['documentId','extractionId','sourceSha256','payloadSha256'])||typeof s.documentId!=='string'||!/^rhed-[a-f0-9]{40}$/.test(s.documentId)||typeof s.extractionId!=='string'||!/^rhge-[a-f0-9]{40}$/.test(s.extractionId)||!hash(s.sourceSha256)||!hash(s.payloadSha256)||
  typeof input.clauseId!=='string'||!/^clause-[1-4]$/.test(input.clauseId)||!['design_check','background'].includes(input.purpose)||input.confirmed!==true)fail('CITATION_INPUT_INVALID');
 return input;
}
export function citationTargetState(ref,contentMd){
 const t=ref?.target;
 return t&&planParagraphs(contentMd).some(p=>p.start===t.start&&p.end===t.end&&p.sha256===t.sha256)?'matched':'changed';
}
export function assertCitationAddition(refs,input){
 if(!Array.isArray(refs)||refs.length>=12)fail('CITATION_LIMIT');
 if(refs.some(r=>r.source.documentId===input.source.documentId&&r.source.extractionId===input.source.extractionId&&r.clauseId===input.clauseId&&r.target.start===input.target.start&&r.target.end===input.target.end&&r.target.sha256===input.target.sha256))fail('CITATION_DUPLICATE');
}
