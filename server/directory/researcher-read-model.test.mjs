import test from 'node:test';
import assert from 'node:assert/strict';
import {projectDirectory,listDirectory,facetDirectory} from './read-model.mjs';
test('approved current affiliation keeps its exact verified month; a pending replacement hides it',()=>{
 const g=fixture(),a=g.heads.find(h=>h.kind==='affiliation');a.payload.startMonth='2021-03';a.payload.endMonth=null;
 let item=projectDirectory(g,'public',{kind:'researcher'})[0];assert.equal(item.affiliations[0].startMonth,'2021-03');assert.equal(item.affiliations[0].current,true);assert.equal(item.affiliations[0].endMonth,null);
 g.heads.push({...a,id:'replacement',revision:2,decision:null,payload:{...a.payload,startMonth:'2025-01'}});item=projectDirectory(g,'public',{kind:'researcher'})[0];assert.equal(item.affiliations.length,0);assert.equal(item.organization,null);
});
const source={available:true,fingerprint:'synthetic',title:'合成目录资料'};
const decision={version:1,decision:'approve',audience:'public',createdAt:'2026-11-12T00:00:00Z'};
function fixture(){
 const entities=[['p','researcher'],['o','organization'],['o2','organization'],['t','team'],['t2','team']].map(([id,kind])=>({id,kind}));
 const h=(id,entityId,kind,payload,relatedEntityId=null)=>({id,entityId,kind,assertionKey:id,revision:1,hash:id,payload,relatedEntityId,sources:[source],decision});
 return {entities,heads:[...entities.map(e=>h(e.id+'-profile',e.id,'profile',{name:{p:'研究者甲',o:'机构甲',o2:'机构乙',t:'团队甲',t2:'团队乙'}[e.id],directions:['针灸'],rank:e.id==='p'?'教授':null,researchRole:e.id==='p'?'负责人':null})),h('aff','p','affiliation',{current:true,isPrimaryForDisplay:true,city:{name:'北京市',region:'北京市'}},'o'),h('member','p','team_member',{current:true,isPrimary:true,memberRole:'lead'},'t')]};
}
test('researcher projection chooses explicit team and routes to same researcher, never to a team ID',()=>{
 const item=projectDirectory(fixture(),'public',{kind:'researcher'})[0];
 assert.equal(item.detailUrl,'/pages/r02/?id=p');assert.equal(item.primaryTeam.id,'t');assert.equal(item.primaryTeam.name,'团队甲');assert.equal(item.currentAffiliation.name,'机构甲');assert.equal(item.metrics.publications.value,null);
});
test('researcher-only filters are applied with disjunctive facets and readable institution labels',()=>{
 const items=projectDirectory(fixture(),'public',{kind:'researcher'}),q={page:1,pageSize:10,sort:'teams',organizationId:'o',rank:'教授',researchRole:'负责人'};
 assert.equal(listDirectory(items,q,'r',{kind:'researcher'}).pagination.totalItems,1);
 assert.equal(listDirectory(items,{...q,q:'不存在'},'r',{kind:'researcher'}).pagination.totalItems,0);
 const facets=facetDirectory(items,q,{kind:'researcher'});assert.deepEqual(facets.organizationId,[{value:'o',label:'机构甲',count:1}]);assert.equal(facets.rank[0].value,'教授');
 assert.throws(()=>listDirectory(items,{...q,rank:'未审核职称'},'r',{kind:'researcher'}),{status:400});
});
test('multiple primary teams are never guessed, and current source or team withdrawal removes relationships',()=>{
 const g=fixture();g.heads.push({...g.heads.at(-1),id:'member2',assertionKey:'member2',relatedEntityId:'t2'});
 assert.equal(projectDirectory(g,'public',{kind:'researcher'})[0].primaryTeam,null);
 assert.equal(projectDirectory(g,'public',{kind:'researcher'})[0].teamProjectionStatus,'CONFLICT');
 g.heads.find(h=>h.entityId==='t2'&&h.kind==='profile').sources=[{available:false}];
 assert.equal(projectDirectory(g,'public',{kind:'researcher'})[0].primaryTeam.id,'t');
 g.heads.find(h=>h.entityId==='p'&&h.kind==='profile').decision={...decision,audience:'tenant'};
 assert.equal(projectDirectory(g,'public',{kind:'researcher'}).length,0);assert.equal(projectDirectory(g,'tenant',{kind:'researcher'}).length,1);
});
test('researcher pagination and stable ties preserve all positions without invented totals',()=>{
 const first=projectDirectory(fixture(),'public',{kind:'researcher'})[0],items=Array.from({length:21},(_,i)=>({...first,id:'p-'+String(i).padStart(2,'0')}));
 const pages=[1,2,3].map(page=>listDirectory(items,{page,sort:'publications'},'r',{kind:'researcher'}));
 assert.deepEqual(pages.map(p=>p.items.length),[10,10,1]);assert.equal(new Set(pages.flatMap(p=>p.items.map(i=>i.id))).size,21);
});
test('sole indexed participation is not an explicit primary team; only one marked primary is projected',()=>{
 const g=fixture();g.heads.find(h=>h.kind==='team_member').payload.isPrimary=false;
 assert.equal(projectDirectory(g,'public',{kind:'researcher'})[0].primaryTeam,null);
 g.heads.push({...g.heads.at(-1),id:'other',assertionKey:'other',relatedEntityId:'t2'});assert.equal(projectDirectory(g,'public',{kind:'researcher'})[0].primaryTeam,null);
 g.heads.at(-1).payload={...g.heads.at(-1).payload,isPrimary:true};assert.equal(projectDirectory(g,'public',{kind:'researcher'})[0].primaryTeam.id,'t2');
});
