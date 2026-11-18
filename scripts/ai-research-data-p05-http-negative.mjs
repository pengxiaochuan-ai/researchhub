import assert from 'node:assert/strict';import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
const root='/Users/mac/aisciencesys/',base='http://127.0.0.1:19501',{ids,password}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8')),cfg=JSON.parse(readFileSync(new URL('../.tmp/ai-file-data-2026-11-12/p05-authorized-scope.json',import.meta.url),'utf8'));
const profiles=JSON.parse(readFileSync(new URL('../.tmp/ai-file-data-2026-11-12/p05-browser-profiles-1794557432477/result.json',import.meta.url),'utf8')),visits=JSON.parse(readFileSync(new URL('../.tmp/ai-file-data-2026-11-12/p05-browser-visits-1794557573418/result.json',import.meta.url),'utf8')),out='.tmp/ai-file-data-2026-11-12/p05-http-negative-'+Date.now();mkdirSync(out,{recursive:true,mode:0o700});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),request=pw.request??pw.default.request,records=[];let passed=false;
const headers={'X-Study-Group-Id':ids.group,'X-Research-Project-Id':ids.project,Origin:base};
try{
 for(const actor of ['owner','admin']){const ctx=await request.newContext();try{
  assert.equal((await ctx.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:ids.tenant,username:actor+'@example.org',password}})).status(),201);
  const own=visits.actors[actor].confirmed,other=visits.actors[actor==='owner'?'admin':'owner'].confirmed,sid=cfg.sessions[ids[actor]],prefix=base+'/api/sessions/'+sid+'/research-data-imports';
  const check=async(label,url,{method='POST',data,status}={})=>{const r=await ctx[method==='GET'?'get':'post'](url,{headers,...(data?{data}:{})});records.push({actor,label,status:r.status()});assert.equal(r.status(),status,label);return r;};
  await check('another account plan through own session',prefix+'/'+other.id,{method:'GET',status:404});
  await check('another account source session',base+'/api/sessions/'+cfg.sessions[ids[actor==='owner'?'admin':'owner']]+'/research-data-imports/'+other.id,{method:'GET',status:403});
  await check('client cannot declare an admin permit',prefix,{data:{requestKey:'p05-http-deny-'+actor,studyId:cfg.target.studyId,preflightId:own.preflight.id,preflightVersion:own.preflight.version,authorized:true},status:400});
  await check('unapproved destination Study',prefix,{data:{requestKey:'p05-http-study-'+actor,studyId:'unapproved-study',preflightId:own.preflight.id,preflightVersion:own.preflight.version},status:403});
  await check('other account cannot be confirmed',prefix+'/'+other.id+'/confirmations',{data:{version:1,hash:other.hash},status:404});
  await check('wrong fixed confirmation hash',prefix+'/'+own.id+'/confirmations',{data:{version:1,hash:'f'.repeat(64)},status:409});
  await check('stale confirmation version',prefix+'/'+own.id+'/confirmations',{data:{version:99,hash:own.hash},status:409});
  await check('no export action',prefix+'/'+own.id+'/export',{data:{},status:404});
  const replay=await check('same original confirmation returns original committed receipt',prefix+'/'+own.id+'/confirmations',{data:{version:1,hash:own.hash},status:201});assert.deepEqual((await replay.json()).receipt,own.receipt);
  const profile=profiles.actors[actor].confirmed,r=await check('historical profile receipt remains readable with current grant',prefix+'/receipts/'+profile.requestKey,{method:'GET',status:200});assert.equal((await r.json()).item.receipt.subjects.length,2);
  // Run only after the required P05 source-cancellation guard is loaded.
  const cancelled=await check('committed import protects source preflight from cancellation',base+'/api/sessions/'+sid+'/data-preflights/'+own.preflight.id+'/cancellation',{data:{version:own.preflight.version},status:409});assert.equal((await cancelled.json()).code,'DATA_ALREADY_IMPORTED');
  const preserved=await check('receipt remains readable after refused source cancellation',prefix+'/'+own.id,{method:'GET',status:200});assert.deepEqual((await preserved.json()).receipt,own.receipt);
  const source=await check('source preview remains current after refused cancellation',base+'/api/sessions/'+sid+'/data-preflights',{method:'GET',status:200});assert.equal((await source.json()).item.version,own.preflight.version);
  await check('data question blocks before an AI job',base+'/api/sessions/'+sid+'/knowledge-messages',{data:{requestKey:'p05-no-data-ai-'+actor,text:'分析本会话刚导入的研究数据',kbIds:[]},status:409});
 }finally{try{await ctx.post(base+'/api/auth/logout',{headers:{Origin:base},data:{}});}finally{await ctx.dispose();}}}
 passed=true;
}catch(e){records.push({failed:e.code??e.name,message:String(e.message).split('\n')[0].slice(0,250)});process.exitCode=1;}
writeFileSync(out+'/result.json',JSON.stringify({passed,records,modelCalls:0,newObjects:0},null,2),{mode:0o600});console.log(JSON.stringify({passed,evidence:out,cases:records.length,failed:records.find(r=>r.failed),modelCalls:0}));
