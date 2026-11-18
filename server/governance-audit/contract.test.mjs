import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAuditQuery,projectAudit,projectProof} from './contract.mjs';
test('audit filters are bounded and unknown parameters rejected',()=>{
 assert.deepEqual(parseAuditQuery({}),{take:20,skip:0});
 for(const q of [{tenantId:'other'},{take:'0'},{skip:'-1'},{take:'1e2'},{action:'<script>'},{target:'a?secret=x'}])assert.throws(()=>parseAuditQuery(q),{status:400});
 assert.equal(parseAuditQuery({action:'researchhub.protocol.approve',target:'p-1',skip:'20'}).skip,20);
});
const row={id:'log-1',tenantId:'t',accountId:'a',action:'researchhub.protocol.approve',target:'p-1',createdAt:new Date('2026-11-13T00:00:00Z'),meta:{password:'SECRET',reason:'PATIENT',token:'SECRET'}};
test('list never projects meta or assumes success from action',()=>{
 const v=projectAudit(row,'管理员');assert.equal(v.result,'未记录结果');assert.equal(v.actionLabel,'批准研究方案');assert(!JSON.stringify(v).includes('SECRET'));assert(!JSON.stringify(v).includes('PATIENT'));
});
test('unknown actions and invalid target retain minimal metadata without invented evidence',()=>{
 const v=projectAudit({...row,action:'unknown_action',target:'secret@example.org'},null);assert.equal(v.objectId,null);assert.equal(v.actionLabel,'其他操作');assert.equal(v.actorLabel,'操作者未记录');
});
test('unsupported action, missing metadata and failed verification are distinct',()=>{
 assert.equal(projectProof({...row,action:'unknown'},null).status,'unrecognized');assert.equal(projectProof({...row,meta:{}},null).status,'missing');assert.equal(projectProof(row,null).status,'unavailable');
});
test('prototype property names remain unrecognized plain action labels',()=>{
 for(const action of ['constructor','__proto__','toString']){assert.equal(projectAudit({...row,action},null).actionLabel,'其他操作');assert.equal(projectProof({...row,action},null).status,'unrecognized');}
});
test('receipt proof must match audit, actor, action and target; private protocol body is excluded',()=>{
 const p={audit_id:row.id,actor_id:row.accountId,action:'protocol.approve',target_id:row.target,result:{protocol:{id:row.target,versionNumber:2,status:'approved',methodsSummary:'SECRET'},policy:{sections:'SECRET'}}};
 const v=projectProof(row,{kind:'operation',row:p});assert.equal(v.status,'verified');assert.deepEqual(v.fields,[{label:'方案版本',value:'2'},{label:'该次提交后的状态',value:'已批准'}]);assert(!JSON.stringify(v).includes('SECRET'));
 for(const key of ['audit_id','actor_id','action','target_id'])assert.equal(projectProof(row,{kind:'operation',row:{...p,[key]:'bad'}}).status,'unavailable');
});
test('directory proof exposes decision/version only and unknown evidence is explicit',()=>{
 const v=projectProof({...row,action:'directory_decision_approve'},{kind:'decision',row:{decision:'approve',decision_version:2,audience:'tenant'}});assert.equal(v.status,'verified');assert(!JSON.stringify(v).includes('reason'));assert.equal(projectProof(row,null).status,'unavailable');
});
test('token proof projects reconciled usage, never prompt, credentials or remaining balance',()=>{
 const v=projectProof({...row,action:'hub.token.reconciled'},{kind:'billing',row:{actualTokens:125,prompt:'SECRET',balance:999}});assert.equal(v.status,'verified');assert.deepEqual(v.fields,[{label:'该次已结算Token',value:'125'}]);assert(!JSON.stringify(v).includes('SECRET'));assert(!JSON.stringify(v).includes('999'));
});
