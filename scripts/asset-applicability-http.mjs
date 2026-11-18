import assert from 'node:assert/strict';import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';import {randomUUID} from 'node:crypto';
import {assetApplicabilityRuntime} from '../tests/fixtures/asset-applicability-runtime.mjs';
assert.deepEqual(process.argv.slice(2),['--mode','local-synthetic']);
const out='/Users/mac/aisciencesys/docs/test/evidence/2026-10-26-researchhub-wp09-asset-applicability/http-'+randomUUID().slice(0,8)+'/';mkdirSync(out,{recursive:true,mode:0o700});const contexts=[],checks=[];let stage='runtime';
try{
 const rt=await assetApplicabilityRuntime(),runtime=JSON.parse(readFileSync(rt.dir+'runtime.json')),pw=await import(rt.root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),request=pw.request??pw.default.request;
 const json=async(r,status)=>{assert.equal(r.status(),status,'HTTP '+new URL(r.url()).pathname);return r.json();},records={};
 for(const actor of ['owner','admin']){
  stage=actor+'-http';const u=rt.users[actor],f=rt.prior[actor],c=await request.newContext({baseURL:'http://127.0.0.1:19501',extraHTTPHeaders:{'X-Study-Group-Id':u.studyGroupId,'X-Research-Project-Id':u.researchProjectId}});contexts.push(c);
  await json(await c.post('/api/auth/login',{data:{tenantSlug:u.tenantId,username:actor+'@example.org',password:runtime.password}}),201);
  await json(await c.get('/api/asset-applicability-drafts'),200);
  const a=await rt.assets.read(u,f.assetId),p=await rt.plans.withDraft(u,f.root.planId,'artifact.read',async(_t,p)=>p.a.currentVersionNo),body={assetId:a.id,assetVersionNo:a.version,targetPlanId:f.root.planId,targetVersionNo:p,requestKey:'wp09-http-'+randomUUID()},base='/api/asset-applicability-drafts';
  await json(await c.post(base+'?unknown=1',{data:body}),400);await json(await c.post(base,{data:{...body,extra:true}}),400);
  const r=await json(await c.post(base,{data:body}),201),retry=await json(await c.post(base,{data:body}),201);assert.deepEqual(retry.operation,r.operation);assert.equal(r.record.ai.status,'not_requested');assert.equal(r.record.version,1);
  const path=base+'/'+r.record.id;assert.equal((await json(await c.get(path),200)).id,r.record.id);assert.equal((await json(await c.get(path+'/versions/1'),200)).readOnly,true);
  for(const url of [base+'?limit=21',base+'?limit=20&limit=20',path+'?extra=1',path+'/versions/31'])await json(await c.get(url),400);
  const huge=' '.repeat(33000)+JSON.stringify(body);assert.equal((await json(await c.post(base,{data:huge,headers:{'Content-Type':'application/json'}}),400)).code,'APPLICABILITY_REQUEST_TOO_LARGE');
  stage=actor+'-opinions-http';const opinion={baseVersionNo:1,resultMessageId:null,basisChangeConfirmed:false,decisions:[{ruleId:'question',decision:'reference',reason:'仅作声明参考，保留待核对事项'}],requestKey:'wp09-http-opinion-'+randomUUID()},saved=await json(await c.post(path+'/opinions',{data:opinion}),201);assert.equal(saved.record.version,2);assert.equal(saved.record.opinionHead.basisKind,'rules');
  const retried=await json(await c.post(path+'/opinions',{data:opinion}),201);assert.deepEqual(retried.operation,saved.operation);await json(await c.post(path+'/opinions?extra=1',{data:{...opinion,requestKey:'wp09-reject-q-'+randomUUID()}}),400);
  await json(await c.post(path+'/opinions',{data:{...opinion,baseVersionNo:2,requestKey:body.requestKey}}),409);await json(await c.post(path+'/opinions',{data:{...opinion,baseVersionNo:2,requestKey:'wp09-no-change-'+randomUUID()}}),422);
  assert.equal((await json(await c.get(path+'/versions/1'),200)).opinions.question,undefined);
  const encoded=base+'/%'+r.record.id.charCodeAt(0).toString(16)+r.record.id.slice(1);assert.equal((await json(await c.post(encoded+'/opinions/',{data:huge,headers:{'Content-Type':'application/json'}}),400)).code,'APPLICABILITY_REQUEST_TOO_LARGE');
  const before=await c.get('/api/sessions/'+r.record.executionSessionId+'/knowledge-state');assert.equal(before.status(),403);
  const noChat=await c.post('/api/sessions/'+r.record.executionSessionId+'/knowledge-messages',{data:{text:'此处不允许通用聊天',requestKey:'wp09-nochat-'+randomUUID(),kbIds:[r.record.kbId]}});assert.equal(noChat.status(),403);
  for(const action of ['share','approve','lock','publish','export'])await json(await c.post(path+'/'+action,{data:{}}),404);
  records[actor]={recordId:r.record.id,body};checks.push(actor+'-real-http-create-read-opinions-history-retry-cross-action-no-change-strict-query-raw32KiB-and-no-generic-chat-or-governance');
 }
 await json(await contexts[1].get('/api/asset-applicability-drafts/'+records.owner.recordId),403);
 writeFileSync(out+'records.json',JSON.stringify(records,null,2),{mode:0o600});writeFileSync(out+'result.json',JSON.stringify({passed:true,checks,realHttp:true,modelCalls:0},null,2));console.log(JSON.stringify({passed:true,checks:checks.length,evidence:out,modelCalls:0}));
}catch(e){writeFileSync(out+'failure.json',JSON.stringify({passed:false,stage,error:e.getResponse?.()?.code??e.code??e.name,frames:e.stack?.split('\n').filter(v=>/^\s+at /.test(v)).slice(0,5)},null,2));console.error(JSON.stringify({passed:false,stage,evidence:out,error:e.getResponse?.()?.code??e.code??e.name}));process.exitCode=1;}finally{for(const c of contexts)await c.dispose();}
