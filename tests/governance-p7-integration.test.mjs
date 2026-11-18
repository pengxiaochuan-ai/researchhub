import test from 'node:test';import assert from 'node:assert/strict';
import * as overview from '../src/governance-overview.js';
import {readFormalRoute,formalBackHref} from '../src/formal-preparation-session.js';
const {loadGovernanceItems,governanceCoverage,governanceItemHref,selectGovernanceItems}=overview;
const item=(id,kind,at)=>({studyId:'study',studyTitle:'合成研究',protocol:{id:'protocol',title:'合成方案',versionNumber:1,status:'executing',updatedAt:'2026-11-13T10:00:00Z'},decision:{id,kind,createdAt:at,actorName:'管理员',reason:null}});
test('overview processed results reuse real decisions and retain distinct actions for the same version',async()=>{
 const urls=[];const rows=await loadGovernanceItems('protocols','processed',{protocolRequest:async url=>{urls.push(url);return{items:[item('approve','approved','2026-11-13T08:00:00Z'),item('activate','activated','2026-11-13T09:00:00Z')],nextCursor:null};}});
 assert.match(urls[0],/^\/research-studies\/protocol-decisions\?/);assert.equal(rows.length,2);assert.equal(new Set(rows.map(x=>x.eventKey)).size,2);assert.equal(rows[0].disposition,'processed');assert.equal(rows[0].updatedAt,'2026-11-13T08:00:00Z');assert.match(rows[0].stateLabel,/已批准/);assert.match(rows[1].stateLabel,/已启用/);
 const sorted=selectGovernanceItems({protocols:{state:'ready',items:rows}},'ethics','processed');assert.equal(sorted[0].id,'study:protocol:activate');const link=new URL(governanceItemHref(sorted[0],{module:'ethics',page:2}),'http://localhost');assert.equal(link.searchParams.get('studyId'),'study');assert.equal(link.searchParams.get('protocolId'),'protocol');assert.equal(link.searchParams.get('reviewTab'),null);assert.equal(link.searchParams.get('governancePage'),'2');assert.equal(formalBackHref(readFormalRoute('s07',link.search)),'/pages/g02/?governanceModule=ethics&governancePage=2');
 assert.deepEqual(governanceCoverage(null,'ethics','processed').selected,['protocols']);
});
test('processed decisions consume cursor pages and reject duplicate IDs, failed or malformed reads',async()=>{
 let n=0;const rows=await loadGovernanceItems('protocols','processed',{protocolRequest:async()=>({items:[item(n++?'b':'a','returned','2026-11-13T07:00:00Z')],nextCursor:n===1?'cursor':null})});assert.equal(rows.length,2);
 await assert.rejects(()=>loadGovernanceItems('protocols','processed',{protocolRequest:async()=>({items:[item('a','approved','2026-11-13T07:00:00Z')],nextCursor:'cursor'})}));
 await assert.rejects(()=>loadGovernanceItems('protocols','processed',{protocolRequest:async()=>{throw Object.assign(Error('denied'),{status:403});}}),{status:403});
 await assert.rejects(()=>loadGovernanceItems('protocols','processed',{protocolRequest:async()=>({items:[item('a','approved','invalid')],nextCursor:null})}));
});
test('governance navigation keeps data and system distinct and never mislabels invitations as multicenter',()=>{
 assert.equal(typeof overview.governanceNavTarget,'function');assert.equal(overview.governanceNavTarget('数据治理'),'/pages/g02/?view=source-review');assert.equal(overview.governanceNavTarget('系统配置'),'/pages/g02/?view=token-reconciliation');assert.equal(overview.governanceNavTarget('多中心管理'),'/pages/g02/?governanceModule=centers');assert.equal(overview.governanceNavTarget('未知'),null);
});
