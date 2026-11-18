import test from 'node:test';
import assert from 'node:assert/strict';
import {validateResearchDirectory,readResearchDirectoryRange,readResearchExecution} from '../src/research-directory-session.js';
const row=n=>({key:'intent:i'+n,kind:'intent',id:'i'+n,title:'课题'+n,summary:'问题',status:'draft',updatedAt:'2026-11-11T00:00:00.000Z',intentId:'i'+n,links:{primary:'/pages/q01/?researchCreation=1&projectIntentId=i'+n,edit:'/pages/q01/?researchCreation=1&projectIntentId=i'+n},capabilities:{canEdit:true,canOpenStudy:false}});
const page=(items,total=items.length,nextCursor=null)=>({items,total,nextCursor,capabilities:{canCreateProject:true}});
test('directory accepts real draft and legacy destinations, rejects external links and partial response shapes',()=>{
 const legacy={...row(2),key:'execution:p2',kind:'execution',id:'p2',links:{primary:'/pages/s01/?studyGroupId=g2&researchProjectId=p2'},capabilities:{canEdit:false,canOpenStudy:true}};
 assert.equal(validateResearchDirectory(page([row(1),legacy])).total,2);
 for(const href of ['https://other.invalid/private','//other.invalid/','/pages/q01/?researchCreation=1&projectIntentId=i1&actor=other','/pages/s01/?researchStudy=1&studyId=bad%2Fscope'])assert.throws(()=>validateResearchDirectory(page([{...row(1),links:{primary:href}}])));
 assert.throws(()=>validateResearchDirectory({items:[],total:0,nextCursor:null}));
 assert.throws(()=>validateResearchDirectory(page([row(1),row(1)])));
 assert.throws(()=>validateResearchDirectory(page([row(1)],0)));
});
test('preview and expanded range use the same server search and preserve only freshly authorized rows',async()=>{
 const calls=[];const request=async path=>{calls.push(path);const q=new URL('http://local'+path).searchParams;assert.equal(q.get('q'),'睡眠 研究');return q.has('cursor')?page([row(3)],3):page([row(1),row(2)],3,'cursor-next');};
 const expanded=await readResearchDirectoryRange(request,{count:3,query:'睡眠 研究'});assert.deepEqual(expanded.items.map(r=>r.id),['i1','i2','i3']);assert.equal(expanded.total,3);assert.equal(expanded.nextCursor,null);assert.equal(calls.length,2);
 const revoked=await readResearchDirectoryRange(async()=>page([row(3)],1),{count:3,query:'睡眠 研究'});assert.deepEqual(revoked.items.map(r=>r.id),['i3']);
});
test('unstable total, duplicate pages and looping cursors fail instead of presenting a complete but wrong directory',async()=>{
 let n=0;await assert.rejects(readResearchDirectoryRange(async()=>++n===1?page([row(1)],2,'next'):page([row(2)],3),{count:2}),e=>e.code==='RESEARCH_DIRECTORY_CHANGED');
 n=0;await assert.rejects(readResearchDirectoryRange(async()=>++n===1?page([row(1)],2,'next'):page([row(1)],2,'next'),{count:2}));
});
test('large expanded ranges request bounded pages and never fetch beyond the requested visible range',async()=>{
 const sizes=[];let offset=0;const data=await readResearchDirectoryRange(async path=>{const q=new URL('http://local'+path).searchParams,limit=Number(q.get('limit'));sizes.push(limit);const items=Array.from({length:limit},(_,n)=>row(offset+n));offset+=limit;return page(items,300,'next-'+offset);},{count:125});
 assert.deepEqual(sizes,[100,25]);assert.equal(data.items.length,125);assert.equal(data.nextCursor,'next-125');
});
test('precise legacy detail is tied to the requested scope and does not infer current access from a previous overview',async()=>{
 const value={profile:{displayName:'本人',tenantName:'租户'},group:{id:'g1',name:'受邀研究组'},project:{id:'p1',name:'受邀课题',description:null,status:'active',studyGroupId:'g1',canReadDrafts:false,canReadTasks:false,canOpenDesignWorkspace:false},capabilities:{canOpenStudy:true,canEdit:false}};
 const scope={studyGroupId:'g1',researchProjectId:'p1'};
 assert.deepEqual(await readResearchExecution(async path=>{assert.equal(path,'/research-directory/execution/p1?studyGroupId=g1');return value;},scope),value);
 await assert.rejects(readResearchExecution(async()=>({...value,group:{id:'g2',name:'其他组'}}),scope));
 await assert.rejects(readResearchExecution(async()=>{throw Object.assign(Error('撤权'),{status:404});},scope),e=>e.status===404);
});
