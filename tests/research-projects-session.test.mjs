import test from 'node:test';
import assert from 'node:assert/strict';
import {researchProjectUrl,researchStudyUrl,readResearchProjectRoute,createResearchProjectsClient,createProjectMutation,researchCreationHeader,readResearchProjectRange} from '../src/research-projects-session.js';
import {realModeRouteState} from '../src/real-mode-route.js';
test('creation URLs preserve intent identity and malformed live routes cannot show demo',()=>{
 assert.equal(researchProjectUrl('intent_1'),'/pages/q01/?researchCreation=1&projectIntentId=intent_1');
 assert.equal(researchStudyUrl('study_1'),'/pages/s01/?researchStudy=1&studyId=study_1');
 assert.deepEqual(readResearchProjectRoute('q01','?researchCreation=1'),{kind:'creation',id:null});
 assert.throws(()=>readResearchProjectRoute('q01','?researchCreation=1&projectIntentId=a&projectIntentId=b'));
 for(const [page,search] of [['q01','?researchCreation=bad'],['q02','?researchProjects=1'],['s01','?researchStudy=1&studyId=s']])assert.equal(realModeRouteState(page,search,{configured:true}),'live');
 assert.equal(readResearchProjectRoute('q01','?researchCreation=1&researchPlanId=old'),null);
});
test('unknown mutation outcome retries exactly the original body and key',async()=>{
 const calls=[];let attempt=0;const mutation=createProjectMutation({request:async(path,options)=>{calls.push([path,options]);if(!attempt++)throw Object.assign(Error('网络中断'),{unknown:true});return{item:{id:'saved'}};},key:()=> 'same-key'});
 await assert.rejects(mutation.submit('/research-projects','POST',{title:'A'}));
 assert.equal(mutation.pending().body.title,'A');
 await assert.rejects(mutation.submit('/research-projects','POST',{title:'B'}),/待确认/);
 assert.deepEqual(await mutation.retry(),{item:{id:'saved'}});
 assert.deepEqual(calls[0],calls[1]);assert.equal(mutation.pending(),null);
});
test('current permission failure clears pending but conflict preserves editor responsibility',async()=>{
 const mutation=createProjectMutation({request:async()=>{throw Object.assign(Error('冲突'),{status:409});},key:()=> 'one'});
 await assert.rejects(mutation.submit('/research-projects/i','PATCH',{title:'A',expectedVersion:1}));
 assert.equal(mutation.pending(),null);
});
test('invalidated in-flight read never delivers previous identity data',async()=>{
 let resolve;const client=createResearchProjectsClient({fetchImpl:()=>new Promise(r=>resolve=r)});
 const read=client.request('/research-projects');client.invalidate();resolve({ok:true,json:async()=>({items:[{title:'private'}]})});
 await assert.rejects(read,error=>error.code==='RESEARCH_STALE');
});
test('cookie requests omit caller identity and retain genuine zero counts',async()=>{
 let options;const client=createResearchProjectsClient({fetchImpl:async(url,input)=>{assert.equal(url,'/api/research-studies/s');options=input;return{ok:true,json:async()=>({item:{counts:{subjects:0}}})};}});
 assert.equal((await client.request('/research-studies/s')).item.counts.subjects,0);assert.equal(options.credentials,'same-origin');assert.equal(options.cache,'no-store');
});
test('access loss invalidates another read and never treats ordinary forbidden as logout',async()=>{
 const denied=[];let resolve;let count=0;
 const client=createResearchProjectsClient({onAccessLost:error=>denied.push(error.status),fetchImpl:async()=>{if(!count++)return new Promise(r=>resolve=r);return{ok:false,status:403,json:async()=>({message:'权限已撤回'})};}});
 const older=client.request('/research-projects');
 await assert.rejects(client.request('/research-projects/i'),error=>error.status===403);
 resolve({ok:true,json:async()=>({items:[{title:'private'}]})});
 await assert.rejects(older,error=>error.code==='RESEARCH_STALE');assert.deepEqual(denied,[403]);
});
test('server failure keeps an unconfirmed write while definitive validation failure permits correction',async()=>{
 let status=503;const client=createResearchProjectsClient({fetchImpl:async()=>({ok:false,status,json:async()=>({message:'暂不可用'})})});
 const mutation=createProjectMutation({request:client.request,key:()=> 'request-1'});
 await assert.rejects(mutation.submit('/research-projects','POST',{title:'A'}));assert(mutation.pending());
 status=400;await assert.rejects(mutation.retry());assert.equal(mutation.pending(),null);
});

test('new creation header removes demo actions while old plan route stays intact',()=>{
 const original={title:'示例',description:'合成课题',actions:[['生成研究方案','s07',true]],hide:['.legacy'],nav:[['demo']]};
 const header=researchCreationHeader(original,'q01','?researchCreation=1');
 assert.equal(header.title,'研究课题');assert.deepEqual(header.actions,[]);assert.equal(header.nav,undefined);
 assert.equal(researchCreationHeader(original,'q01','?researchPlanId=old&researchCreation=1'),original);assert.equal(original.actions.length,1);
});
test('explicit real creation markers override prior demo choice across the whole loop',()=>{
 for(const [page,search] of [['q01','?researchCreation=1'],['q01','?researchCreation=invalid'],['q02','?researchProjects=1'],['q02','?researchProjects=invalid'],['s01','?researchStudy=1&studyId=s'],['s01','?researchStudy=invalid']])assert.equal(realModeRouteState(page,search,{configured:true,explicitDemo:true}),'live');
 assert.equal(realModeRouteState('q02','',{configured:true,explicitDemo:true}),'demo');
});

test('refresh retains the expanded authorized range and removes revoked rows',async()=>{
 const old=Array.from({length:23},(_,i)=>({id:'old-'+i}));let authorized=old.slice(),calls=[];
 const request=async path=>{const url=new URL(path,'http://local'),limit=Number(url.searchParams.get('limit')),cursor=url.searchParams.get('cursor');calls.push(path);const start=cursor?authorized.findIndex(row=>row.id===cursor)+1:0,items=authorized.slice(start,start+limit);return{items,nextCursor:start+limit<authorized.length?items.at(-1).id:null};};
 const expanded=await readResearchProjectRange(request,23);assert.equal(expanded.items.length,23);assert.equal(expanded.nextCursor,null);
 authorized=old.filter(item=>item.id!=='old-21');const refreshed=await readResearchProjectRange(request,23);assert.equal(refreshed.items.length,22);assert(!refreshed.items.some(item=>item.id==='old-21'));assert.equal(refreshed.nextCursor,null);
 const first=await readResearchProjectRange(request,0);assert.equal(first.items.length,20);assert.equal(first.nextCursor,'old-19');
});

test('a lifecycle cancellation signal preserves the client timeout and both can end a hung read',async t=>{
 let deadline=new AbortController();const lifecycle=new AbortController();let signal;
 t.mock.method(AbortSignal,'timeout',()=>deadline.signal);
 const client=createResearchProjectsClient({fetchImpl:(_path,options)=>{signal=options.signal;return new Promise((_resolve,reject)=>{signal.addEventListener('abort',()=>reject(signal.reason),{once:true});});}});
 const read=client.request('/research-directory',{signal:lifecycle.signal});
 assert.notEqual(signal,lifecycle.signal,'lifecycle must not replace the deadline');
 deadline.abort(Error('deadline'));await assert.rejects(read,error=>error.cause?.message==='deadline');
 deadline=new AbortController();const cancelled=client.request('/research-directory',{signal:lifecycle.signal});
 lifecycle.abort(Error('page left'));await assert.rejects(cancelled);
});

test('an absent WF01 receipt keeps editor access and input; real project access loss still invalidates',async()=>{
 let code='RESEARCH_RECEIPT_NOT_FOUND';const lost=[];const client=createResearchProjectsClient({onAccessLost:error=>lost.push(error),fetchImpl:async()=>({ok:false,status:404,json:async()=>({code,message:'尚无可核回执'})})});
 await assert.rejects(client.request('/research-projects/receipts/request-key?action=intent.create&requestHash='+'a'.repeat(64)));assert.equal(lost.length,0);
 code='RESEARCH_NOT_FOUND';await assert.rejects(client.request('/research-projects/receipts/request-key?action=intent.create&requestHash='+'a'.repeat(64)));assert.equal(lost.length,1);
});
