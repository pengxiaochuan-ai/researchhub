// Purpose restriction only; never initializes original grants or renews approvals.
import assert from 'node:assert/strict';import {lstatSync,readFileSync} from 'node:fs';import {dirname} from 'node:path';
export const APPLICABILITY_MARKER='rh-asset-applicability.v1',APPLICABILITY_PREFIX='rh-asset-applicability-20261026:';
export const applicabilityId=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(v);
const fail=()=>assert.fail('APPLICABILITY_SCOPE_RESTRICTED'),ok=v=>{if(!v)fail();};
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
export function assertApplicabilityIntent(payload){
 const kinds=['researchPlan','researchDesign','researchExecutionPreparation','researchSyntheticEdc','researchCrfMethods','researchAssetApplicability'];
 assert.ok(kinds.filter(k=>Object.hasOwn(payload??{},k)).length<=1,'APPLICABILITY_MIXED_INTENT');return payload?.researchAssetApplicability??null;
}
export function readAssetApplicabilityScope(path,ids,user,operation='U01',pair,{now=Date.now()}={}){
 let s;try{const f=lstatSync(path),d=lstatSync(dirname(path));ok(f.isFile()&&!f.isSymbolicLink()&&(f.mode&0o077)===0&&f.size<=65536&&d.isDirectory()&&!d.isSymbolicLink()&&(d.mode&0o077)===0);s=JSON.parse(readFileSync(path));}catch{fail();}
 ok(exact(s,['schema','marker','prefix','enabled','approvedAt','expiresAt','tenantId','studyGroupId','researchProjectId','accounts','operations','paidAiApproved','pairs','fixtures']));
 const approved=Date.parse(s.approvedAt),expires=Date.parse(s.expiresAt);
 ok(s.schema==='rh-asset-applicability-scope.v1'&&s.marker===APPLICABILITY_MARKER&&s.prefix===APPLICABILITY_PREFIX&&s.enabled===true&&Number.isFinite(approved)&&approved<=now&&expires>now&&expires-approved===7*86400000&&typeof s.paidAiApproved==='boolean');
 ok(s.tenantId===ids.tenant&&s.studyGroupId===ids.group&&s.researchProjectId===ids.project&&user.tenantId===ids.tenant&&user.studyGroupId===ids.group&&user.researchProjectId===ids.project);
 ok(Array.isArray(s.accounts)&&s.accounts.length===2&&new Set(s.accounts).size===2&&[ids.owner,ids.admin].every(k=>s.accounts.includes(k))&&s.accounts.includes(user.accountId));
 ok(Array.isArray(s.operations)&&new Set(s.operations).size===s.operations.length&&s.operations.every(k=>['U01','U02','U03','U04'].includes(k))&&s.operations.includes('U01')&&s.operations.includes(operation));
 ok(Array.isArray(s.pairs)&&Array.isArray(s.fixtures));const seen=new Set(),counts=new Map();
 for(const p of s.pairs){ok(exact(p,['accountId','assetId','targetPlanId'])&&Object.values(p).every(applicabilityId)&&s.accounts.includes(p.accountId));const k=JSON.stringify(p);ok(!seen.has(k));seen.add(k);counts.set(p.accountId,(counts.get(p.accountId)??0)+1);ok(counts.get(p.accountId)<=6);}
 const fixtureCounts=new Map(),keys=new Set();
 for(const f of s.fixtures){ok(exact(f,['accountId','kind','key','parentId','createdAt','id'])&&s.accounts.includes(f.accountId)&&['asset','target','knowledge'].includes(f.kind)&&typeof f.key==='string'&&f.key.startsWith('rh-asset-applicability-20261026-fixture:')&&f.key.length<=256&&applicabilityId(f.parentId)&&(f.id===null||applicabilityId(f.id))&&Number.isFinite(Date.parse(f.createdAt))&&Date.parse(f.createdAt)>=approved&&Date.parse(f.createdAt)<=now&&!keys.has(f.key));keys.add(f.key);const k=f.accountId+':'+f.kind;fixtureCounts.set(k,(fixtureCounts.get(k)??0)+1);ok(fixtureCounts.get(k)<=(f.kind==='asset'?2:1));}
 if(pair)ok(exact(pair,['accountId','assetId','targetPlanId'])&&pair.accountId===user.accountId&&s.pairs.some(p=>Object.keys(pair).every(k=>p[k]===pair[k])));
 return s;
}
