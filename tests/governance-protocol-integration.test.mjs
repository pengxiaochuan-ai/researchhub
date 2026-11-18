import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGovernanceItems,selectGovernanceItems,governanceItemHref,governanceCoverage} from '../src/governance-overview.js';
import {readFormalRoute,formalHeader,formalBackHref} from '../src/formal-preparation-session.js';
import {safeSessionReturn} from '../src/session-lifecycle.js';

const row=(studyId,id,updatedAt='2026-11-11T00:00:00Z')=>({studyId,studyTitle:'研究'+studyId,protocol:{id,title:'方案'+id,versionNumber:2,status:'pending_review',updatedAt}});
test('pending protocol projection follows empty advancing cursors and keeps distinct study/version identities',async()=>{
 const protocolRequest=async path=>path.includes('cursor=next')?{items:[row('s1','p1'),row('s2','p1')],nextCursor:null}:{items:[],nextCursor:'next'};
 const items=await loadGovernanceItems('protocols','pending',{protocolRequest});
 assert.deepEqual(items.map(x=>[x.eventKey,x.disposition,x.module,x.actionLabel,x.timeLabel]),[['protocols:s1:p1','action','ethics','查看方案','方案更新'],['protocols:s2:p1','action','ethics','查看方案','方案更新']]);
 assert.deepEqual(selectGovernanceItems({protocols:{state:'ready',items}},'ethics','action').map(x=>x.id),['s1:p1','s2:p1']);
});
test('invalid, repeated cursor, duplicate protocol, and read failures cannot appear as successful zero queues',async()=>{
 for(const protocolRequest of [async()=>({items:[row('s1','p1')],nextCursor:'again'}),async()=>({items:[row('s1','p1'),row('s1','p1')],nextCursor:null}),async()=>({items:[{...row('s1','p1'),protocol:{...row('s1','p1').protocol,status:'draft'}}],nextCursor:null}),async()=>{throw Object.assign(Error('denied'),{status:403});}])await assert.rejects(loadGovernanceItems('protocols','pending',{protocolRequest}));
 const control=new AbortController();await assert.rejects(loadGovernanceItems('protocols','pending',{signal:control.signal,protocolRequest:async()=>{control.abort();return{items:[],nextCursor:'next'};}}),{name:'AbortError'});
});
test('protocols share the existing cross-category sorting and approved history is not silently returned as an empty success',async()=>{
 const items=await loadGovernanceItems('protocols','pending',{protocolRequest:async()=>({items:[row('s1','p1')],nextCursor:null})});
 const source={id:'external:a',eventKey:'sources:external:a',disposition:'action',updatedAt:'2026-11-12T00:00:00Z'};
 assert.deepEqual(selectGovernanceItems({protocols:{state:'ready',items},sources:{state:'ready',items:[source]}},'all','action').map(x=>x.eventKey),['protocols:s1:p1','sources:external:a']);
 await assert.rejects(loadGovernanceItems('protocols','processed',{protocolRequest:()=>{throw Error('decision source unavailable');}}),/decision source unavailable/);
});
test('selected-module coverage never counts another module success as its own zero; partial denials are labeled partial',()=>{
 const results={sources:{state:'ready',items:[]},teams:{state:'denied',items:[]},billing:{state:'denied',items:[]},protocols:{state:'ready',items:[]}};
 assert.deepEqual(governanceCoverage(results,'system'),{selected:['billing'],accessible:[],partial:true});
 assert.deepEqual(governanceCoverage(results,'data'),{selected:['sources','teams'],accessible:['sources'],partial:true});
 assert.deepEqual(governanceCoverage(results,'ethics'),{selected:['protocols'],accessible:['protocols'],partial:false});
 assert.deepEqual(governanceCoverage(results,'ethics','processed'),{selected:['protocols'],accessible:['protocols'],partial:false});
});
test('source date is accurately described as its latest review decision, not content update time',async()=>{
 const rows=await loadGovernanceItems('sources','pending',{sourceRequest:async()=>({items:[{key:'external:a',title:'来源',state:{status:'partial'},detail:{decisions:[{createdAt:'2026-11-10T00:00:00Z'}]}}]})});
 assert.equal(rows[0].timeLabel,'最近审核');
});
test('fixed protocol entry and login preserve only a validated governance return context',()=>{
 const href=governanceItemHref({kind:'protocols',id:'s1:p1'},{module:'ethics',page:2});
 assert.equal(href,'/pages/s07/?formalPreparation=1&studyId=s1&protocolId=p1&governanceModule=ethics&governancePage=2');
 assert.deepEqual(readFormalRoute('s07',new URL(href,'http://local').search),{studyId:'s1',protocolId:'p1',governance:{module:'ethics',page:2}});
 assert.equal(formalBackHref(readFormalRoute('s07',new URL(href,'http://local').search)),'/pages/g02/?governanceModule=ethics&governancePage=2');
 assert.equal(safeSessionReturn(href),href);
 const config=formalHeader({},'s07',new URL(href,'http://local').search);assert.deepEqual(config.crumbs[0],['管理与治理','g02',{governanceModule:'ethics',governancePage:'2'}]);
 for(const suffix of ['&governanceModule=https://evil.example&governancePage=2','&governanceModule=ethics','&governanceModule=data&governancePage=-1','&governanceModule=data&governanceModule=ethics&governancePage=2'])assert.equal(safeSessionReturn('/pages/s07/?formalPreparation=1&studyId=s1&protocolId=p1'+suffix),'/pages/p01/');
 assert.throws(()=>readFormalRoute('s11','?formalPreparation=1&studyId=s1&governanceModule=ethics&governancePage=2'));
});
