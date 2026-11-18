import test from 'node:test';import assert from 'node:assert/strict';
const views=await import('./research-assets-catalog-views.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const now=Date.parse('2026-11-13T01:00:00Z'),p={tenantId:'t',studyGroupId:'g',researchProjectId:'p',accountId:'owner',identityRevision:'a'.repeat(64),projectName:'当前研究',catalogActors:{owner:'owner',admin:'admin'}};
function record(id,owner='owner'){return{registry:{assetId:id,tenantId:'t',studyGroupId:'g',researchProjectId:'p',ownerAccountId:owner,ownerName:owner,kind:'protocol',workingVersionNo:1,workingState:'draft',revision:1,releaseState:'unreleased',createdAt:'2026-11-01T00:00:00Z',updatedAt:'2026-11-01T00:00:00Z'},policies:[{version:1,metadata:{title:id,summary:'合成摘要',domains:['针灸']},sourceKind:'author',sourceBindings:[],sourceValid:true,createdBy:owner,createdAt:'2026-11-01T00:00:00Z'}],events:[{type:'created',version:1,revision:1,actorAccountId:owner,createdAt:'2026-11-01T00:00:00Z'}],grants:[]};}
const present=(type,records,extra={})=>{assert.equal(typeof views.presentAssetViews,'function','approved C06 projection is missing');return views.presentAssetViews({type,records,principal:p,query:{},now,...extra});};
test('private graph nodes, contributions and counts share current fixed-version visibility',()=>{
 const a=record('own'),hidden=record('SECRET','admin');a.policies[0].sourceBindings=[{kind:'artifact',id:'SECRET',version:1}];
 const graph=present('graph',[a,hidden]);assert(graph.nodes.some(n=>n.assetId==='own'));assert(!JSON.stringify(graph).includes('SECRET'));assert.equal(graph.edges.length,0);
 const c=present('contributions',[a,hidden]);assert.equal(c.totals.created,1);assert(!JSON.stringify(c).includes('SECRET'));
});
test('recommendations advance real batches and reject stale or cross-identity cursors without fake scores',()=>{
 const records=Array.from({length:6},(_,i)=>record('asset-'+i)),first=present('recommendations',records,{selection:{id:'asset-0',version:1}});
 assert.equal(first.items.length,3);assert(first.nextCursor);assert(!JSON.stringify(first).includes('score'));
 const second=present('recommendations',records,{selection:{id:'asset-0',version:1},cursor:first.nextCursor});assert.equal(second.items.length,2);assert.equal(second.nextCursor,null);assert(first.items.every(a=>!second.items.some(b=>a.id===b.id)));
 assert.throws(()=>present('recommendations',records.slice(0,5),{selection:{id:'asset-0',version:1},cursor:first.nextCursor}),e=>e.status===409);
});
test('Shanghai thirty-day trend counts successful visible types separately at the UTC date boundary',()=>{
 const a=record('own');a.events.push({type:'cited',version:1,revision:2,actorAccountId:'owner',createdAt:'2026-11-12T16:00:00Z'},{type:'cited',version:1,revision:3,actorAccountId:'owner',createdAt:'2026-11-12T15:59:59Z'});
 const value=present('usage',[a]);assert.equal(value.days.length,30);assert.deepEqual(value.days.at(-1),{date:'2026-11-13',cited:1,applied:0,downloaded:0});assert.equal(value.days.at(-2).cited,1);assert.deepEqual(value.totals,{cited:2,applied:0,downloaded:0});
});
test('trash is an explicit owner/admin projection and restore never returns old grants',()=>{
 const a=record('own'),hidden=record('SECRET','admin');a.registry.deletedAt='2026-11-13T00:00:00Z';hidden.registry.deletedAt=a.registry.deletedAt;
 const value=present('trash',[a,hidden]);assert.equal(value.total,1);assert.equal(value.items[0].id,'own');assert(!JSON.stringify(value).includes('SECRET'));assert(!Object.hasOwn(value.items[0],'grants'));
});
test('a knowledge edge carries its verified source title and immutable document target',()=>{
 const a=record('own');a.policies[0].sourceKind='knowledge';a.policies[0].sourceBindings=[{kind:'knowledge',id:'doc',version:2,contentHash:'b'.repeat(64)}];
 const graph=present('graph',[a],{knowledgeDocuments:[{id:'doc',title:'原创方法依据',version:2}]});const source=graph.nodes.find(n=>n.kind==='knowledge');assert.equal(source.title,'原创方法依据');assert.equal(source.knowledgeTarget.docVersion,2);assert.equal(source.knowledgeTarget.contentSha256,'b'.repeat(64));
});
test('committed asset applications enter the real usage metric while file authorization never pretends delivery',()=>{const a=record('own');a.events.push({type:'asset_apply',version:1,revision:2,actorAccountId:'owner',createdAt:'2026-11-13T00:00:00Z'},{type:'file_accessed',version:1,revision:3,actorAccountId:'owner',createdAt:'2026-11-13T00:00:01Z'});const v=present('usage',[a]);assert.equal(v.totals.applied,1);assert.equal(v.totals.downloaded,0);});
