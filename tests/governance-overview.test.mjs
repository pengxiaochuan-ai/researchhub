import test from 'node:test';
import assert from 'node:assert/strict';
import {safeSessionReturn} from '../src/session-lifecycle.js';
import {loadGovernanceItems,governanceLink,governanceTarget,governanceModules,selectGovernanceItems,governanceOverviewLocation,governanceOverviewHref,governanceItemHref,governanceBackHref} from '../src/governance-overview.js';

test('source projection retains missing material for attention and keeps withheld distinct from approval',async()=>{
 const statuses=['pending','partial','changed','unavailable','public','tenant','withheld','public_display'];
 const sourceRequest=async()=>({items:statuses.map(status=>({key:'external:'+status,title:status,state:{status,label:status},detail:{}}))});
 const rows=await loadGovernanceItems('sources','pending',{sourceRequest});
 assert.deepEqual(rows.map(x=>x.title),statuses.slice(0,4));
 assert(rows.every(x=>x.updatedAt===null));
 const done=await loadGovernanceItems('sources','processed',{sourceRequest});
 assert.deepEqual(done.map(x=>x.title),statuses.slice(4));
 assert.equal(done.find(x=>x.title==='withheld').status,'withheld');
});
test('team classification reads every server page and uses reviewed, not hasPublished',async()=>{
 const pages=[];const directory={teamWorkspaces:async({page})=>{pages.push(page);return{items:page===1?[{id:'team-a',name:'有修订',reviewed:false,hasPublished:true}]:[{id:'team-b',name:'已审核',reviewed:true}],pagination:{page,pageSize:1,totalPages:2,totalItems:2}};}};
 assert.deepEqual((await loadGovernanceItems('teams','pending',{directory})).map(x=>x.id),['team-a']);
 assert.deepEqual(pages,[1,2]);
 assert.deepEqual((await loadGovernanceItems('teams','processed',{directory})).map(x=>x.id),['team-b']);
});
test('billing follows full pagination, omits running tasks, preserves unknown usage and exact known status',async()=>{
 const queries=[];const billing={list:async q=>{queries.push(q);return{items:q.page===1?[{id:'reserve-a',accountName:'甲',executing:true},{id:'reserve-b',accountName:'乙',canSettle:false}]:[{id:'reserve-c',accountName:'丙',canSettle:true}],page:q.page,pageSize:2,total:3};}};
 const rows=await loadGovernanceItems('billing','pending',{billing});
 assert.deepEqual(queries,[{page:1,status:'pending'},{page:2,status:'pending'}]);
 assert.deepEqual(rows.map(x=>x.stateLabel),['待核实','可结算']);
 assert(rows.every(x=>x.timeLabel==='发生时间'));
});
test('403, network errors, and malformed pagination never become an empty success',async()=>{
 for(const status of [403,503])await assert.rejects(()=>loadGovernanceItems('sources','pending',{sourceRequest:async()=>{throw Object.assign(Error('rejected'),{status});}}),e=>e.status===status);
 await assert.rejects(()=>loadGovernanceItems('teams','pending',{directory:{teamWorkspaces:async()=>({items:[],pagination:{page:1,totalItems:2,totalPages:2,pageSize:1}})}}));
 await assert.rejects(()=>loadGovernanceItems('sources','pending',{sourceRequest:async()=>({items:[{title:'bad'}]})}));
});
test('category changes between pages and duplicate rows require a fresh read, never a false complete count',async()=>{
 await assert.rejects(()=>loadGovernanceItems('teams','pending',{directory:{teamWorkspaces:async({page})=>({items:[{id:'same',name:'重复',reviewed:false}],pagination:{page,pageSize:1,totalItems:2,totalPages:2}})}}));
});
test('read cancellation stops pagination and does not deliver partial results',async()=>{
 const controller=new AbortController();let calls=0;
 await assert.rejects(()=>loadGovernanceItems('teams','pending',{signal:controller.signal,directory:{teamWorkspaces:async()=>{calls++;controller.abort();return{items:[{id:'a',name:'a',reviewed:false}],pagination:{page:1,pageSize:1,totalItems:2,totalPages:2}};}}}),{name:'AbortError'});
 assert.equal(calls,1);
});
test('links carry only a validated selector; unknown targets cannot redirect or auto-select another object',()=>{
 assert.equal(governanceLink('sources','external:document-1'),'/pages/g02/?view=source-review&reviewKey=external%3Adocument-1');
 assert.equal(governanceTarget('?view=directory-review&team=team-1','teams'),'team-1');
 assert.equal(governanceTarget('?view=token-reconciliation&record=reserve-1','billing'),'reserve-1');
 assert.equal(governanceTarget('?team=https://evil.example','teams'),null);
 assert.throws(()=>governanceLink('billing','bad&record=x'));
});

test('seven business modules are explicit without pretending missing adapters have zero tasks',()=>{
 assert.deepEqual(Object.keys(governanceModules),['ethics','data','quality','access','centers','audit','system']);
 assert.deepEqual(governanceModules.data.adapters,['sources','teams']);
 assert.deepEqual(governanceModules.system.adapters,['billing']);
 assert.deepEqual(governanceModules.ethics.adapters,['protocols']);
 assert.deepEqual(governanceModules.access.adapters,['invitations']);
 for(const module of ['quality','centers','audit'])assert.deepEqual(governanceModules[module].adapters,[]);
});
test('incomplete source and unknown usage are attention items, not immediately actionable approvals or settlements',async()=>{
 const sourceRequest=async()=>({items:[{key:'external:missing',title:'缺原文',state:{status:'unavailable',label:'待补齐内容'},detail:{}},{key:'external:ready',title:'待审',state:{status:'pending',label:'待审核'},detail:{}}]});
 const source=await loadGovernanceItems('sources','pending',{sourceRequest});
 assert.equal(source[0].disposition,'attention');assert.equal(source[0].actionLabel,'查看');assert.equal(source[1].disposition,'action');assert.equal(source[1].actionLabel,'审核');
 const billing={list:async()=>({items:[{id:'known',accountName:'甲',status:'active',canSettle:true},{id:'unknown',accountName:'乙',status:'reconciliation_required',canSettle:false}],page:1,pageSize:20,total:2})};
 const rows=await loadGovernanceItems('billing','pending',{billing});assert.deepEqual(rows.map(x=>x.disposition),['action','attention']);assert.equal(rows[1].actionLabel,'查看');assert(rows.every(x=>x.scopeLabel==='本租户'));
});
test('one global list sorts across adapters by real time, leaves unknown dates last, and deduplicates exact event identities',()=>{
 const item=(key,kind,updatedAt)=>({id:key,eventKey:key,kind,module:kind==='billing'?'system':'data',disposition:'action',updatedAt});
 const source=item('source','sources',null),bill=item('bill','billing','2026-01-01T00:00:00Z'),team=item('team','teams','2026-02-01T00:00:00Z');
 const results={sources:{state:'ready',items:[source]},teams:{state:'ready',items:[team]},billing:{state:'ready',items:[bill,bill]}};
 assert.deepEqual(selectGovernanceItems(results,'all','action').map(x=>x.id),['bill','team','source']);
 assert.deepEqual(selectGovernanceItems(results,'data','action').map(x=>x.id),['team','source']);
 assert.deepEqual(selectGovernanceItems(results,'ethics','action'),[]);
 assert.deepEqual(selectGovernanceItems({...results,billing:{state:'error',items:[bill]}},'all','action').map(x=>x.id),['team','source']);
});
test('processed is an object result, preserves withheld status, and sorts known timestamps newest first without invented actors',async()=>{
 const sourceRequest=async()=>({items:[{key:'external:a',title:'暂不放行',state:{status:'withheld'},detail:{decisions:[{createdAt:'2026-01-01T00:00:00Z'}]}},{key:'external:b',title:'已决定',state:{status:'tenant'},detail:{decisions:[{createdAt:'2026-02-01T00:00:00Z'}]}}]});
 const rows=await loadGovernanceItems('sources','processed',{sourceRequest});
 assert(rows.every(x=>x.disposition==='processed'&&!Object.hasOwn(x,'operatorName')));
 assert.deepEqual(selectGovernanceItems({sources:{state:'ready',items:rows}},'all','processed').map(x=>x.id),['external:b','external:a']);
});
test('overview filter/page and safe object return use only validated module identifiers and positive page numbers',()=>{
 assert.deepEqual(governanceOverviewLocation('?governanceModule=data&governancePage=2'),{module:'data',page:2});
 assert.deepEqual(governanceOverviewLocation('?governanceModule=data&governanceModule=system&governancePage=-1'),{module:'all',page:1});
 assert.equal(governanceOverviewHref({module:'system',page:3}),'/pages/g02/?governanceModule=system&governancePage=3');
 const href=governanceItemHref({kind:'billing',id:'reserve-1'},{module:'system',page:3});
 assert(href.includes('record=reserve-1'));assert.equal(governanceBackHref(new URL(href,'http://local').search),'/pages/g02/?governanceModule=system&governancePage=3');
 assert.equal(governanceBackHref('?overviewModule=https://evil.example&overviewPage=0'),'/pages/g02/');
});
test('expired session keeps only the exact safe governance filter or object route, never external URLs or arbitrary parameters',()=>{
 for(const path of ['/pages/g02/?governanceModule=data&governancePage=2','/pages/g02/?view=source-review&reviewKey=external%3Adoc-1&overviewModule=data&overviewPage=2','/pages/g02/?view=token-reconciliation&record=reserve-1'])assert.equal(safeSessionReturn(path),path);
 for(const path of ['/pages/g02/?governanceModule=data&governanceModule=system','/pages/g02/?governancePage=-1','/pages/g02/?view=source-review&record=wrong-kind','/pages/g02/?governanceModule=https://evil.example','/pages/g02/?returnTo=https://evil.example','/pages/g02/#token=secret'])assert.equal(safeSessionReturn(path),'/pages/p01/');
});
