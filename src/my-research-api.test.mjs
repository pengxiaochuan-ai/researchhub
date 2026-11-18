import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fetchMyResearchOverview,validateMyResearchOverview} from './my-research-api.js';

const empty={profile:{displayName:'新用户',tenantName:'灵枢心域'},studyGroups:[],summary:{projectCount:0,ownDraftCount:0,myOpenTaskCount:0},drafts:[],tasks:[],activity:[]};
test('accepts a genuinely empty database overview',()=>assert.deepEqual(validateMyResearchOverview(empty),empty));
test('rejects a malformed or partial overview instead of falling back to demo data',()=>{
 assert.throws(()=>validateMyResearchOverview({...empty,studyGroups:[{id:'x',name:'非法',projects:[{name:'无ID'}]}]}));
 assert.throws(()=>validateMyResearchOverview({...empty,summary:{projectCount:'5',ownDraftCount:0,myOpenTaskCount:0}}));
});
test('authenticated read uses only the overview endpoint and no cache',async()=>{
 const calls=[];const result=await fetchMyResearchOverview({fetchImpl:async(...args)=>{calls.push(args);return{ok:true,json:async()=>empty};}});
 assert.deepEqual(result,empty);assert.equal(calls[0][0],'/api/my-research/overview');assert.equal(calls[0][1].credentials,'same-origin');assert.equal(calls[0][1].cache,'no-store');
});
test('401 is an explicit login state, not empty or sample data',async()=>{
 await assert.rejects(fetchMyResearchOverview({fetchImpl:async()=>({ok:false,status:401})}),{code:'MY_RESEARCH_UNAUTHENTICATED'});
});
test('independent page selection is encoded and invalid input never sends a request',async()=>{
 let url,calls=0;const fetchImpl=async u=>{calls++;url=u;return{ok:true,json:async()=>empty};};
 await fetchMyResearchOverview({fetchImpl,draftPage:2});assert.equal(url,'/api/my-research/overview?draftPage=2');
 await assert.rejects(fetchMyResearchOverview({fetchImpl,draftPage:-1}));assert.equal(calls,1);
 assert.throws(()=>validateMyResearchOverview({...empty,pagination:{drafts:{page:1,pageSize:5,hasNext:'yes'},tasks:{page:1,pageSize:5,hasNext:false}}}));
});
test('a supplied lifecycle signal does not disable the request timeout',async()=>{
 const controller=new AbortController();
 await assert.rejects(fetchMyResearchOverview({signal:controller.signal,timeoutMs:10,fetchImpl:(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}))}),{code:'MY_RESEARCH_TIMEOUT'});
 assert.equal(controller.signal.aborted,false);
});
