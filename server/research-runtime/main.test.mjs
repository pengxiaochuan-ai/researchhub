import test from 'node:test';
import assert from 'node:assert/strict';
import {runtimeDependencies} from './dependencies.mjs';

const env=()=>({DATABASE_URL:'postgresql://runtime:opaque@localhost:5432/research',DIRECT_URL:'postgresql://owner:opaque@localhost:5432/research',JWT_SECRET:'b'.repeat(48),DEPLOYMENT_ID:'runtime-unit',DEPLOYMENT_PRODUCT:'researchhub',ALLOWED_TENANT_IDS:'tenant-one',DEFAULT_TENANT_ID:'tenant-one',AUTH_COOKIE_NAME:'rh_runtime_unit',HUB_APP_ORIGIN:'http://127.0.0.1:19611',HUB_AUTH_COOKIE_SECURE:'false'});
function dependencies(){
 const {require}=runtimeDependencies(),{Controller,Get,Post,Body,SetMetadata,HttpException}=require('@nestjs/common');
 let connects=0,disconnects=0;
 const prisma={async onModuleInit(){connects++;},async onModuleDestroy(){disconnects++;}};
 const controllerFactory=()=>{
  class Routes { public(){return{ok:true};} protected(){return{private:true};} echo(body){return body;} failure(){throw Error('postgresql://secret:do-not-leak@db/private');} mail(){throw new HttpException({code:'HUB_MAIL_NOT_CONFIGURED',message:'do-not-leak'},503);} }
  Controller('runtime-check')(Routes);
  for(const [name,verb,isPublic] of [['public',Get,true],['protected',Get,false],['echo',Post,true],['failure',Get,true],['mail',Get,true]]){
   const desc=Object.getOwnPropertyDescriptor(Routes.prototype,name);verb(name)(Routes.prototype,name,desc);if(isPublic)SetMetadata('isPublic',true)(Routes.prototype,name,desc);
  }
  Body()(Routes.prototype,'echo',0);return Routes;
 };
 return{prisma,controllerFactory,counts:()=>({connects,disconnects})};
}

test('independent assembly mounts auth and research guards, caps JSON and hides internal errors',async()=>{
 const {bootResearchRuntime}=await import('./main.mjs'),deps=dependencies();
 const runtime=await bootResearchRuntime(env(),{...deps,listen:false});
 try{
  await runtime.app.listen(0,'127.0.0.1');
  const port=runtime.app.getHttpServer().address().port,base='http://127.0.0.1:'+port;
  assert.deepEqual(deps.counts(),{connects:1,disconnects:0});
  let res=await fetch(base+'/api/runtime-check/public');assert.equal(res.status,200);assert.equal(res.headers.get('cache-control'),'no-store');assert.equal(res.headers.get('access-control-allow-origin'),null);
  res=await fetch(base+'/api/runtime-check/protected');assert.equal(res.status,401);
  res=await fetch(base+'/api/auth/me');assert.equal(res.status,401);
  res=await fetch(base+'/api/runtime-check/failure');assert.equal(res.status,500);assert.equal((await res.text()).includes('do-not-leak'),false);
  res=await fetch(base+'/api/runtime-check/mail');assert.equal(res.status,503);assert.deepEqual(await res.json(),{code:'HUB_MAIL_NOT_CONFIGURED',message:'邮件服务尚未启用，请稍后重试或联系管理员。'});
  const post=(body,headers={})=>fetch(base+'/api/runtime-check/echo',{method:'POST',headers:{origin:env().HUB_APP_ORIGIN,'content-type':'application/json',...headers},body});
  res=await post('{"title":"allowed"}');assert.equal(res.status,201);assert.deepEqual(await res.json(),{title:'allowed'});
  res=await post(JSON.stringify({question:'研'.repeat(20000),pico:{p:'研'.repeat(10000),i:'研'.repeat(10000),c:'研'.repeat(10000),o:'研'.repeat(10000)}}));assert.equal(res.status,201);
  res=await post('{"title":"'+ 'x'.repeat(257*1024)+'"}');assert.equal(res.status,413);assert.equal(res.headers.get('cache-control'),'no-store');
  res=await post('{broken-json');assert.equal(res.status,400);assert.equal((await res.text()).includes('broken-json'),false);
  res=await post('"primitive"');assert.equal(res.status,400);
  res=await post('{}',{origin:'https://untrusted.example'});assert.equal(res.status,403);
  res=await post('{}',{'content-type':'text/plain'});assert.equal(res.status,415);
  res=await fetch(base+'/api/knowledge');assert.equal(res.status,404);
 }finally{await runtime.close();await runtime.close();}
 assert.deepEqual(deps.counts(),{connects:1,disconnects:1});
});

test('startup failure closes clients and returns generic error without secret cause',async()=>{
 const {bootResearchRuntime}=await import('./main.mjs'),deps=dependencies();
 await assert.rejects(bootResearchRuntime(env(),{...deps,listen:false,controllerFactory:()=>{throw Error('private-database-password');}}),error=>error.message==='RESEARCH_RUNTIME_START_FAILED'&&!error.cause);
 assert.equal(deps.counts().disconnects,1);
});

test('invalid config fails before injected database or controller is touched',async()=>{
 const {bootResearchRuntime}=await import('./main.mjs'),deps=dependencies();
 await assert.rejects(bootResearchRuntime({...env(),JWT_SECRET:''},{...deps,listen:false}),/JWT_SECRET/);
 assert.deepEqual(deps.counts(),{connects:0,disconnects:0});
});
