import assert from 'node:assert/strict';import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {createRequire} from 'node:module';
import {subjectUrl} from '../src/research-subjects-session.js';import {captureUrl} from '../src/formal-capture-session.js';
const args=process.argv.slice(2),resume=args[0]==='--resume';let phase,out,state;
if(resume){assert.match(args[1]??'',/^\.tmp\/ai-file-data-2026-11-12\/p05-browser-(profiles|visits)-\d+\/result\.json$/);assert.equal(args.length,2);out=args[1].replace('/result.json','');state=JSON.parse(readFileSync(args[1],'utf8'));phase=state.phase;}
else{assert.equal(args[0],'--run-p05-synthetic');phase=args[1];assert(['profiles','visits'].includes(phase)&&args.length===2);out='.tmp/ai-file-data-2026-11-12/p05-browser-'+phase+'-'+Date.now();state={phase,passed:false,actors:{},requests:[],errors:[],blocked:[],cases:[]};}
mkdirSync(out+'/video',{recursive:true,mode:0o700});
const root='/Users/mac/aisciencesys/',base='http://127.0.0.1:19501',{ids,password}=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8')),cfg=JSON.parse(readFileSync(new URL('../.tmp/ai-file-data-2026-11-12/p05-authorized-scope.json',import.meta.url),'utf8')),require=createRequire(root+'app/server/package.json'),XLSX=require('xlsx');
const headers={'X-Study-Group-Id':ids.group,'X-Research-Project-Id':ids.project},postHeaders={...headers,Origin:base},save=()=>writeFileSync(out+'/result.json',JSON.stringify({...state,modelCalls:0,operatorCalls:0},null,2),{mode:0o600});state.passed=false;save();
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try{
 for(const actor of ['owner','admin']){
  const a=state.actors[actor]??={sessionId:cfg.sessions[ids[actor]],uploads:[]};if(a.completed)continue;assert.equal(a.sessionId,cfg.sessions[ids[actor]]);
  const extension=phase==='profiles'?'csv':'xlsx',filename=actor+'-P05-SYNTHETIC-'+phase.toUpperCase()+'.'+extension,path=out+'/'+filename,prefix='P05-'+actor.toUpperCase();
  if(phase==='profiles')writeFileSync(path,`subject_id,note\n${prefix}-A,synthetic\n${prefix}-B,synthetic\n`,{mode:0o600});
  else{const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['subject_id','visit_code','value','completed'],[prefix+'-A','BASELINE',0,false],[prefix+'-B','BASELINE',4,true]]),'基线');writeFileSync(path,XLSX.write(wb,{type:'buffer',bookType:'xlsx'}),{mode:0o600});}
  a.fixture=path;save();const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out+'/video'}});
  try{
   assert.equal((await context.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:ids.tenant,username:actor+'@example.org',password}})).status(),201);
   const get=async suffix=>{const r=await context.request.get(base+'/api'+suffix,{headers});assert.equal(r.status(),200,'GET '+suffix+' returned '+r.status());return r.json();};
   await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());if(url.origin!==base){state.blocked.push({actor,origin:url.origin});return route.abort();}
    if(url.pathname.startsWith('/api/')&&!['GET','HEAD','OPTIONS'].includes(request.method())&&!['/api/auth/renew'].includes(url.pathname)&&!new RegExp('^/api/sessions/'+a.sessionId+'/(research-data|data-preflights|research-data-imports)(?:/[A-Za-z0-9_-]+/(?:cancellation|confirmations))?$').test(url.pathname)){state.blocked.push({actor,path:url.pathname});save();return route.abort();}
    if(actor==='admin'&&phase==='profiles'&&!a.responseLost&&request.method()==='POST'&&url.pathname.endsWith('/confirmations')){
     const response=await route.fetch();const body=await response.json();assert.equal(response.status(),201);a.confirmed=body;a.responseLost=true;save();return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'本次导入结果尚未确认，请核对状态。'})});
    }
    return route.continue();
   });
   const page=await context.newPage();page.on('pageerror',e=>{state.errors.push({actor,message:e.message});save();});page.on('response',async r=>{const url=new URL(r.url());if(!/\/(research-data|data-preflights)/.test(url.pathname))return;state.requests.push({actor,method:r.request().method(),path:url.pathname,status:r.status()});if(r.request().method()==='POST'&&url.pathname.endsWith('/research-data')&&r.status()===201){const row=await r.json();if(!a.uploads.some(u=>u.id===row.id))a.uploads.push(row);}save();});
   await page.goto(base+'/pages/ai01/?sessionId='+a.sessionId);await page.getByRole('button',{name:'上传文件',exact:true}).waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='上传文件'&&!b.disabled));
   const existing=(await get('/sessions/'+a.sessionId+'/research-data?limit=20')).items.filter(f=>f.name===filename);assert(existing.length<=1,'P05_DUPLICATE_FILENAME');
   if(!existing.length){const previewed=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/sessions/'+a.sessionId+'/data-preflights');await page.locator('input[data-agent-materials]').setInputFiles(path);assert.equal((await previewed).status(),201);}
   else if(!a.uploads.some(u=>u.id===existing[0].id))a.uploads.push(existing[0]);
   const selected=(await get('/sessions/'+a.sessionId+'/research-data?limit=20')).items.find(f=>f.name===filename);assert(selected?.state==='ready');a.uploads=[selected];
   let source=(await get('/sessions/'+a.sessionId+'/data-preflights')).item;
   if(!source||source.state!=='previewed'||source.files.length!==1||source.files[0].id!==selected.id){a.recoveryPreflightKey??='p05-preview-'+crypto.randomUUID();save();const r=await context.request.post(base+'/api/sessions/'+a.sessionId+'/data-preflights',{headers:postHeaders,data:{requestKey:a.recoveryPreflightKey,files:[{id:selected.id,version:selected.version}]}});assert.equal(r.status(),201);source=await r.json();await page.reload();}
   a.preflight=source;assert.equal(source.result.files[0].rowsRead,2);assert.equal(source.result.files[0].rejectedRows,0);save();
   await page.waitForFunction(()=>[...document.querySelectorAll('.research-data-import button')].some(b=>b.textContent.trim()==='确认导入')||[...document.querySelectorAll('.research-data-import')].some(e=>e.textContent.includes('已导入2名被试')),{},{timeout:15000});
   a.plan=(await get('/sessions/'+a.sessionId+'/research-data-imports')).item;assert.equal(a.plan.preflight.id,source.id);assert.equal(a.plan.summary.subjects,2);assert.equal(a.plan.mode,phase==='profiles'?'subjects':'visit_form');save();
   if(a.plan.state==='planned')await page.getByRole('button',{name:'确认导入',exact:true}).click();
   if(actor==='admin'&&phase==='profiles'){
    await page.waitForFunction(()=>[...document.querySelectorAll('.research-data-import')].some(e=>e.textContent.includes('已导入2名被试'))||[...document.querySelectorAll('.research-data-import button')].some(b=>b.textContent.trim()==='核对状态'),{},{timeout:15000});
    if(await page.locator('.research-data-import').getByRole('button',{name:'核对状态',exact:true}).count())await page.locator('.research-data-import').getByRole('button',{name:'核对状态',exact:true}).click();
   }
   await page.getByText('已导入2名被试',{exact:false}).waitFor({timeout:15000});a.confirmed=(await get('/sessions/'+a.sessionId+'/research-data-imports')).item;assert.equal(a.confirmed.state,'committed');assert.equal(a.confirmed.receipt.subjects.length,2);assert.equal(a.confirmed.receipt.visits.length,phase==='profiles'?0:2);assert.equal(await page.getByText('研究数据尚未导入',{exact:false}).count(),0);save();
   const posts=state.requests.filter(r=>r.actor===actor&&r.method==='POST').length;await page.reload();await page.getByText('已导入2名被试',{exact:false}).waitFor({timeout:15000});assert.equal(state.requests.filter(r=>r.actor===actor&&r.method==='POST').length,posts,'refresh cannot repeat data writes');await page.screenshot({path:out+'/'+actor+'-confirmed.png',fullPage:true});state.cases.push(actor+'-'+phase+'-single-confirm-refresh');save();
   await page.getByRole('link',{name:'查看本次被试',exact:true}).click();await page.getByText(prefix+'-A',{exact:true}).waitFor();await page.getByText(prefix+'-B',{exact:true}).waitFor();await page.screenshot({path:out+'/'+actor+'-subjects.png',fullPage:true});
   if(actor==='owner'){assert.equal(await page.getByText('P05-ADMIN-A',{exact:true}).count(),0);const r=await context.request.post(base+'/api/research-studies/'+cfg.target.studyId+'/subjects',{headers:postHeaders,data:{requestKey:'p05-forbidden-subject',subjectId:'P05-OWNER-C'}});assert.equal(r.status(),403);}
   if(phase==='visits'){
    const first=a.confirmed.receipt.visits.find(v=>v.subjectId===a.confirmed.receipt.subjects.find(s=>s.subjectCode===prefix+'-A').id),url=captureUrl('s09',cfg.target.studyId,{visitId:first.id,assignmentId:first.assignmentId,responseId:first.ref.responseId,revisionNo:first.ref.revisionNo,contentHash:first.ref.contentHash});await page.goto(base+url);await page.getByRole('heading',{name:'访视与数据录入',exact:true}).waitFor();await page.getByText(prefix+'-A',{exact:false}).first().waitFor();await page.screenshot({path:out+'/'+actor+'-visit.png',fullPage:true});
    const actual=await get('/research-studies/'+cfg.target.studyId+'/assignments/'+first.assignmentId);assert.deepEqual(actual.response.answers,{value:0,completed:false});assert.equal(actual.response.ref.contentHash,first.ref.contentHash);
   }
   a.completed=true;save();
  }finally{try{await context.request.post(base+'/api/auth/logout',{headers:{Origin:base},data:{}});}finally{await context.close();}}
 }
 assert.deepEqual(state.errors,[]);assert.deepEqual(state.blocked,[]);state.passed=true;delete state.failure;
}catch(e){state.failure={code:e.code??e.name,message:String(e.message).split('\n')[0].slice(0,400),at:e.stack?.split('\n').find(x=>x.includes('ai-research-data-p05-browser.mjs:'))?.trim()};process.exitCode=1;}
finally{await browser.close();save();console.log(JSON.stringify({passed:state.passed,phase,evidence:out,cases:state.cases,errors:state.errors.length,blocked:state.blocked.length,failure:state.failure,modelCalls:0}));}
