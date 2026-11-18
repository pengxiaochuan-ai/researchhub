import test from 'node:test';import assert from 'node:assert/strict';import {createKnowledgeClient} from '../src/knowledge-session.js';
const api=await import('../src/research-data-session.js').catch(()=>({}));
test('column descriptions use user-language units and quality counts, without converting the raw cell display',()=>{
 assert.equal(api.researchDataColumnDescription({unit:'kg',profile:{type:'number',nonMissing:3,missing:1}}),'单位：kg；数值；已记录3项，空值1项');
 assert.match(api.researchDataColumnDescription({profile:{type:'mixed',nonMissing:2,missing:0}}),/类型混合，需核对/);
 assert.equal(api.researchDataColumnDescription({unit:null}),'');
 assert.match(api.researchDataMappingDescription({sourceLabel:'体重(g)',targetLabel:'体重',targetUnit:'kg',sourceUnit:'g',conversionPower:-3}),/体重\(g\).*体重.*kg.*换算/);
});
test('research data transport allows exact own upload/preview/receipt/cancel paths, not commit or arbitrary paths',async()=>{
 assert.equal(typeof api.researchDataRequestAllowed,'function');
 for(const [method,path]of [['GET','/sessions/s/research-data?limit=20'],['POST','/sessions/s/research-data'],['GET','/sessions/s/data-preflights'],['POST','/sessions/s/data-preflights'],['GET','/sessions/s/data-preflights/receipts/key'],['POST','/sessions/s/data-preflights/plan/cancellation']]){
  assert(api.researchDataRequestAllowed(method,path));const client=createKnowledgeClient({scope:()=>({studyGroupId:'g',researchProjectId:'p'}),fetchImpl:async()=>({ok:true,headers:{get:()=> 'application/json'},json:async()=>({})})});await client[method==='GET'?'get':'post'](path,method==='POST'?{}:undefined);
 }
 for(const path of ['/sessions/s/data-preflights/commit','/sessions/s/research-data/../../other','/sessions/s/research-data?limit=5000'])assert(!api.researchDataRequestAllowed('POST',path));
});
test('data page and preview state are not converted into knowledge materials or AI permission',()=>{
 const row={kind:'research-data',id:'d',version:2,name:'合成.csv',state:'ready',summary:{rowsRead:2,rejectedRows:0},createdAt:'2026-11-13T00:00:00Z'};
 assert.deepEqual(api.assertResearchDataPage({items:[row],nextCursor:null}).items,[row]);
 assert.throws(()=>api.assertResearchDataPage({items:[{...row,kind:'knowledge'}],nextCursor:null}));
 assert.equal(api.researchDataIssueLabel('SUBJECT_CODE_INVALID'),'被试编号需要核对');assert.equal(api.researchDataCell(0),'0');assert.equal(api.researchDataCell(false),'false');assert.equal(api.researchDataCell(null),'未提供');
});
