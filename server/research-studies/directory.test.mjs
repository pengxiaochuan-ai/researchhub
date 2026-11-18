import test from 'node:test';
import assert from 'node:assert/strict';
import {readDirectoryQuery,encodeDirectoryCursor,mergeDirectoryPages,presentDirectoryItem,legacyProjectPermitted} from './directory.mjs';
const user={tenantId:'t1',accountId:'a1',authVersion:2};
test('internal review cursors preserve each raw microsecond boundary without changing public directory DTO',()=>{
 const row=(key,time)=>({key,updated_at:time,intent_read:true,intent_id:key.split(':')[1],title:key,status:'draft',summary:''}),pages=[{total:3,items:[row('intent:a','2026-11-11T00:00:00.123999Z'),row('intent:b','2026-11-11T00:00:00.123001Z'),row('intent:c','2026-11-10T00:00:00.000000Z')]}],q=readDirectoryQuery({limit:'2'},user);
 const ordinary=mergeDirectoryPages(pages,user,q),internal=mergeDirectoryPages(pages,user,q,{reviewCursors:true});assert.equal(ordinary.items[0].reviewCursor,undefined);assert.equal(readDirectoryQuery({cursor:internal.items[0].reviewCursor},user).last.time,'2026-11-11T00:00:00.123999Z');assert.equal(internal.items[1].reviewCursor,internal.nextCursor);
 const all=mergeDirectoryPages(pages,user,readDirectoryQuery({limit:'3'},user),{reviewCursors:true});assert.equal(all.items[2].reviewCursor,null);assert(all.items[1].reviewCursor);
});
test('legacy explicit membership retains metadata access without workbench and rejects invalid parent chains',()=>{
 const group={id:'g1',tenantId:'t1',status:'active'},membership={tenantId:'t1',studyGroupId:'g1',status:'active',role:{tenantId:'t1',status:'active',menuPermissions:[],buttonPermissions:[]}},project={id:'p1',tenantId:'t1',studyGroupId:'g1',status:'active'},member={tenantId:'t1',studyGroupId:'g1',researchProjectId:'p1',status:'active'};
 assert.equal(legacyProjectPermitted(user,group,membership,project,member),true);
 assert.equal(legacyProjectPermitted(user,group,membership,project,null),false);
 assert.equal(legacyProjectPermitted(user,group,{...membership,status:'disabled'},project,member),false);
 assert.equal(legacyProjectPermitted(user,group,membership,{...project,studyGroupId:'g2'},member),false);
 assert.equal(legacyProjectPermitted({...user,role:'tenant_admin',isTenantAdmin:true},group,null,project,null),true);
});
test('legacy-only row never exposes hidden intent identifiers or content',()=>{
 const item=presentDirectoryItem({key:'execution:p1',execution_id:'p1',group_id:'g1',group_name:'研究组',legacy_read:true,intent_read:false,title:'旧受邀研究',summary:'已授权简介',status:'active',updated_at:'2026-11-11T02:00:00.000Z',intent_id:'SECRET',study_id:'SECRET-STUDY',can_edit:false,study_read:false});
 assert.equal(item.kind,'execution');assert.equal(item.intentId,undefined);assert.equal(item.studyId,undefined);assert.equal(item.links.primary,'/pages/s01/?studyGroupId=g1&researchProjectId=p1');assert(!JSON.stringify(item).includes('SECRET'));
});
test('intent owner losing study permission keeps an openable intent entry without study action',()=>{
 const item=presentDirectoryItem({key:'execution:p1',execution_id:'p1',group_id:'g1',group_name:'研究组',legacy_read:false,intent_read:true,title:'本人课题',summary:'研究问题',status:'study_created',updated_at:'2026-11-11T02:00:00.000Z',intent_id:'i1',study_id:'s1',can_edit:false,study_read:false});
 assert.equal(item.links.primary,'/pages/q01/?researchCreation=1&projectIntentId=i1');assert.equal(item.links.overview,undefined);assert.equal(item.links.edit,undefined);assert.equal(item.capabilities.canOpenStudy,false);
});
test('per-source bounded pages merge by date and key with exact authorized totals',()=>{
 const row=(key,time)=>({key,updated_at:time,intent_read:true,intent_id:key,title:key,summary:'',status:'draft',can_edit:true,study_read:false,legacy_read:false});
 const pages=[{total:4,items:[row('intent:b','2026-11-11T00:00:00.000Z'),row('intent:a','2026-11-10T00:00:00.000Z')]},{total:8,items:[row('execution:c','2026-11-11T00:00:00.000Z'),row('execution:d','2026-11-09T00:00:00.000Z')]}];
 const result=mergeDirectoryPages(pages,user,readDirectoryQuery({limit:'2'},user));assert.equal(result.total,12);assert.deepEqual(result.items.map(r=>r.key),['intent:b','execution:c']);assert(result.nextCursor);
 const query=readDirectoryQuery({limit:'5',cursor:result.nextCursor},user);assert.equal(query.last.key,'execution:c');assert.equal(query.limit,5);
});
test('cursor is bounded, actor tenant version query and order bound, never authority',()=>{
 const cursor=encodeDirectoryCursor(user,{q:'睡眠'},{key:'intent:a',updated_at:'2026-11-11T00:00:00.000Z'});
 assert.equal(readDirectoryQuery({q:'睡眠',cursor},user).last.key,'intent:a');
 for(const [query,actor]of [[{q:'抑郁',cursor},user],[{q:'睡眠',cursor},{...user,accountId:'a2'}],[{q:'睡眠',cursor},{...user,tenantId:'t2'}],[{q:'睡眠',cursor},{...user,authVersion:3}],[{cursor:'!bad'},user],[{limit:'101'},user],[{q:'x'.repeat(201)},user],[{actor:'a2'},user]])assert.throws(()=>readDirectoryQuery(query,actor),e=>e.status===400);
});
test('microsecond ordering survives cross-group merge and cursor roundtrip',()=>{
 const row=(key,time)=>({key,updated_at:time,intent_read:true,intent_id:key.split(':')[1],title:key,status:'draft',summary:''});
 const newer=row('intent:a','2026-11-11T00:00:00.123999+00:00'),older=row('intent:z','2026-11-11T00:00:00.123001+00:00');
 const result=mergeDirectoryPages([{total:1,items:[older]},{total:1,items:[newer]}],user,readDirectoryQuery({limit:'1'},user));
 assert.equal(result.items[0].key,'intent:a');assert.equal(readDirectoryQuery({cursor:result.nextCursor},user).last.time,'2026-11-11T00:00:00.123999Z');
});
test('directory response carries current creation capability without a separate context fetch',()=>{
 assert.deepEqual(mergeDirectoryPages([{total:0,items:[]}],user,readDirectoryQuery({},user)).capabilities,{canCreateProject:true});
});
test('directory summary is at most 160 characters without shortening title',()=>{
 const title='完整题名'.repeat(60),summary='研究问题'.repeat(500),item=presentDirectoryItem({key:'intent:i1',intent_read:true,intent_id:'i1',title,summary,status:'draft',updated_at:'2026-11-11T00:00:00.000000Z'});
 assert.equal(item.title,title);assert.equal(Array.from(item.summary).length,160);assert(item.summary.endsWith('…'));
});
