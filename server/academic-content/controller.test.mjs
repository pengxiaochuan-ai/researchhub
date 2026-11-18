import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAcademicContentControllers} from './controller.mjs';
function nest(){const routes=[],metadata=[];class HttpException extends Error{constructor(body,status){super(body.message);this.status=status;this.body=body;}}const noop=()=>()=>{};const api={HttpException,Controller:prefix=>Class=>{Class.prefix=prefix;},SetMetadata:(key,value)=>(proto,name)=>metadata.push({proto,name,key,value}),Get:path=>(proto,name)=>routes.push({proto,name,path,verb:'GET'}),Post:path=>(proto,name)=>routes.push({proto,name,path,verb:'POST'}),Patch:path=>(proto,name)=>routes.push({proto,name,path,verb:'PATCH'}),Req:noop,Res:noop,Body:noop,Param:noop,Query:noop,HttpCode:noop};return{require:()=>api,routes,metadata};}
test('only fixed public controller bypasses authentication and never uses a supplied principal',async()=>{
 const n=nest(),seen=[],service={hubKey:'lingshu-xinyu',list:async(p,q)=>{seen.push(p);return{items:[],nextCursor:null};},resource:async(p)=>{seen.push(p);return{url:'https://example.org/source'};}};
 const [Public,Member,Admin]=createAcademicContentControllers({...n,service,origin:'https://hub.example'});
 assert.equal(Public.prefix,'public/hubs/:hubKey/academic-content');assert.equal(Member.prefix,'hubs/:hubKey/academic-content');assert.equal(Admin.prefix,'hubs/:hubKey/content-management');
 const res={setHeader(){},redirect(code,url){this.destination={code,url};}};
 await new Public().list({method:'GET',user:{accountId:'admin'}},res,'lingshu-xinyu',{});assert.deepEqual(seen,[null]);
 await assert.rejects(new Public().list({method:'GET'},res,'other',{}),e=>e.status===404);
 await assert.rejects(new Member().list({method:'GET'},res,'lingshu-xinyu',{}),e=>e.status===401);
 for(const record of n.metadata.filter(x=>x.key==='isPublic'&&x.value))assert.equal(record.proto,Public.prototype);
 await new Public().resource({method:'GET'},res,'lingshu-xinyu','content','key',{});assert.deepEqual(res.destination,{code:302,url:'https://example.org/source'});
});
test('management mutation keeps same-origin JSON and refuses query/body ambiguity',async()=>{
 const n=nest();let calls=0;const service={hubKey:'lingshu-xinyu',create:async()=>{calls++;return{};}};const [,,Admin]=createAcademicContentControllers({...n,service,origin:'https://hub.example'}),res={setHeader(){}};
 const req={method:'POST',headers:{origin:'https://other.example','content-type':'application/json'},query:{},user:{accountId:'admin'}};
 await assert.rejects(new Admin().create(req,res,'lingshu-xinyu',{}),e=>e.status===403);assert.equal(calls,0);
 await assert.rejects(new Admin().create({...req,headers:{origin:'https://hub.example','content-type':'application/json'},query:{draft:'true'}},res,'lingshu-xinyu',{}),e=>e.status===400);assert.equal(calls,0);
});
