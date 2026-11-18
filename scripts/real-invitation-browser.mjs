// New named local synthetic Study only. Never print or persist passwords, cookies, or invitation links.
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {invitationRunAction} from './real-invitation-resume.mjs';

process.umask(0o077);
const root=fileURLToPath(new URL('../../',import.meta.url));
const privateDir=root+'.tmp/researchhub-real-entry/';
const out=root+'docs/test/evidence/2026-10-28-researchhub-real-entry/';
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8'));
const account=JSON.parse(readFileSync(privateDir+'account.json','utf8'));
const fixture=JSON.parse(readFileSync(privateDir+'invitation-fixture.json','utf8'));
const stateFile=privateDir+'invitation-run.json';
const state=existsSync(stateFile)?JSON.parse(readFileSync(stateFile,'utf8')):{invited:false,accepted:false};
const save=()=>writeFileSync(stateFile,JSON.stringify(state,null,2),{mode:0o600});
mkdirSync(out,{recursive:true});
const base='http://127.0.0.1:19501';
const inbox='http://127.0.0.1:19507';
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser=await (pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const adminContext=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
const userContext=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
const admin=await adminContext.newPage(),user=await userContext.newPage();
let stage='preflight',scopeStatuses=null;
const checks=[],requests=[],errors=[];
for(const [actor,page] of [['admin',admin],['invitee',user]]){
  page.on('pageerror',()=>errors.push({actor,type:'pageerror'}));
  page.on('response',response=>{const url=new URL(response.url());if(url.origin===base&&url.pathname.startsWith('/api/'))requests.push({actor,path:url.pathname,method:response.request().method(),status:response.status()});});
}
async function login(page,email,password){
  await page.goto(base+'/pages/p003/');
  await page.getByLabel('邮箱',{exact:true}).fill(email);
  await page.getByLabel('密码',{exact:true}).fill(password);
  await page.getByRole('button',{name:'登录',exact:true}).click();
  await page.waitForURL(url=>url.pathname==='/pages/p01/',{timeout:15000});
}
async function contextStatus(browserContext,groupId,projectId){
  const response=await browserContext.request.get(base+'/api/member-invitations/context',{headers:{'X-Study-Group-Id':groupId,'X-Research-Project-Id':projectId}});
  return response.status();
}
async function invitationLink(){
  const sessionFile=privateDir+'inbox-session.json';
  let cookie=existsSync(sessionFile)?JSON.parse(readFileSync(sessionFile,'utf8')).cookie:null;
  if(!cookie||(await fetch(inbox+'/messages',{headers:{Cookie:cookie}})).status!==200){
    const {bootstrap}=JSON.parse(readFileSync(root+'.tmp/researchhub-wp02/mail/inbox-credentials.json','utf8'));
    const opened=await fetch(inbox+'/session',{method:'POST',headers:{Origin:inbox,'Content-Type':'application/json'},body:JSON.stringify({bootstrap})});
    assert.equal(opened.status,200,'PRIVATE_INBOX_SESSION_REQUIRED');
    cookie=opened.headers.get('set-cookie').split(';')[0];
    writeFileSync(sessionFile,JSON.stringify({cookie}),{mode:0o600});
  }
  const listing=await fetch(inbox+'/messages',{headers:{Cookie:cookie}});
  assert.equal(listing.status,200,'PRIVATE_INBOX_UNAVAILABLE');
  const messages=await listing.json();
  const matches=messages.items.filter(item=>item.to===account.email&&item.purpose==='invite'&&item.capturedAt>=state.issuedAt);
  assert.equal(matches.length,1,'EXACTLY_ONE_CURRENT_INVITATION_MAIL_REQUIRED');
  const item=matches[0];
  const message=await fetch(inbox+'/messages/'+item.id,{headers:{Cookie:cookie}});
  assert.equal(message.status,200,'INVITATION_MAIL_UNAVAILABLE');
  const body=await message.json();
  const link=body.text.match(/http:\/\/127\.0\.0\.1:19501\/pages\/p010\/#invite=[A-Za-z0-9_-]{43}/)?.[0];
  assert(link,'INVITATION_LINK_MISSING');
  return {link,receipt:{id:item.id,digest:item.digest,capturedAt:item.capturedAt,purpose:item.purpose}};
}
async function openClean(page,link){await page.goto(link);await page.waitForURL(url=>url.hash==='');assert.equal(new URL(page.url()).hash,'');}

try{
  assert.equal(fixture.tenantId,runtime.ids.tenant);
  assert.equal(fixture.inviterId,runtime.ids.admin);
  assert.equal(fixture.inviteeEmail,account.email);
  stage='user-before-invite';
  await login(user,account.email,account.newPassword);
  if(!state.accepted){
    const me=await userContext.request.get(base+'/api/auth/me');assert.equal(me.status(),200);
    assert.deepEqual((await me.json()).studyGroups,[]);
    checks.push('new-account-has-zero-private-study-before-invite');
  }
  stage='admin-context';
  await login(admin,'admin@example.org',runtime.password);
  scopeStatuses={old:await contextStatus(adminContext,runtime.ids.group,runtime.ids.project),current:await contextStatus(adminContext,fixture.groupId,fixture.projectId)};
  assert.equal(scopeStatuses.old,403,'OLD_STUDY_MUST_REMAIN_FORBIDDEN');
  assert.equal(scopeStatuses.current,200,'NEW_STUDY_MANAGER_REQUIRED');
  checks.push('old-study-403-new-study-manager-200');
  const scoped='/pages/s11/?'+new URLSearchParams({members:'1',studyGroupId:fixture.groupId,researchProjectId:fixture.projectId});
  await admin.goto(base+scoped);
  await admin.getByRole('button',{name:'发送Study邀请',exact:true}).waitFor();
  assert.equal(await admin.getByText('真实入口邀请联调合成Study',{exact:true}).count(),1);
  const listed=await adminContext.request.get(base+'/api/member-invitations',{headers:{'X-Study-Group-Id':fixture.groupId,'X-Research-Project-Id':fixture.projectId}});
  assert.equal(listed.status(),200,'NEW_STUDY_INVITATION_LIST_REQUIRED');
  const listing=await listed.json();
  assert.equal(listing.nextCursor,null,'NEW_STUDY_INVITATION_LIST_MUST_BE_COMPLETE');
  const action=invitationRunAction({state,items:listing.items,email:account.email});
  if(action==='issue'){
    stage='send-captured-invitation';
    await admin.getByLabel('受邀合成邮箱',{exact:true}).fill(account.email);
    state.issuedAt=new Date().toISOString();save();
    await admin.getByRole('button',{name:'发送Study邀请',exact:true}).click();
    await admin.getByRole('status').filter({hasText:'邀请邮件已在本机捕获'}).waitFor();
    state.invited=true;save();
  }else if(!state.invited){state.invited=true;save();}
  await admin.screenshot({path:out+'invite-manager-new-study.png',fullPage:true});
  checks.push('admin-invitation-captured-in-new-study');
  stage='inbox-capture';
  const {link,receipt}=await invitationLink();
  state.receipt=receipt;save();
  stage='wrong-account-preview';
  await openClean(admin,link);
  await admin.getByRole('alert').waitFor();
  assert.equal(await admin.getByRole('button',{name:'确认接受最小只读邀请',exact:true}).count(),0);
  assert.equal(await admin.getByText('真实入口邀请联调合成Study',{exact:true}).count(),0);
  checks.push('wrong-account-cannot-preview-study-or-accept');
  if(!state.accepted){
    stage='correct-account-preview';
    await openClean(user,link);
    await user.getByRole('heading',{name:'真实入口邀请联调合成Study',exact:true}).waitFor();
    await user.getByRole('button',{name:'确认接受最小只读邀请',exact:true}).waitFor();
    await user.screenshot({path:out+'invite-correct-account-preview.png',fullPage:true});
    const before=await userContext.request.get(base+'/api/auth/me');
    assert.deepEqual((await before.json()).studyGroups,[],'OPENING_LINK_MUST_NOT_ADD_MEMBER');
    checks.push('preview-does-not-add-member');
    stage='explicit-accept';
    await user.getByRole('button',{name:'确认接受最小只读邀请',exact:true}).click();
    await user.getByRole('status').filter({hasText:'本邀请已接受'}).waitFor();
    state.accepted=true;save();
  }
  stage='scope-after-accept';
  const me=await userContext.request.get(base+'/api/auth/me');assert.equal(me.status(),200);
  const identity=await me.json();
  assert.equal(identity.studyGroups.length,1);
  assert.equal(identity.studyGroups[0].id,fixture.groupId);
  assert.equal(identity.studyGroups[0].researchProjects.length,1);
  assert.equal(identity.studyGroups[0].researchProjects[0].id,fixture.projectId);
  assert.equal(identity.studyGroups[0].researchProjects[0].roleKey,'researcher');
  assert.equal(await contextStatus(userContext,fixture.groupId,fixture.projectId),200);
  assert.equal(await contextStatus(userContext,runtime.ids.group,runtime.ids.project),403);
  checks.push('invitee-only-new-study-readonly-old-study-403');
  await user.goto(base+scoped);
  await user.getByText('当前为该Study最小只读身份，没有邀请或成员管理权限。',{exact:true}).waitFor();
  assert.equal(await user.getByRole('button',{name:'发送Study邀请',exact:true}).count(),0);
  await user.screenshot({path:out+'invitee-new-study-readonly.png',fullPage:true});
  await user.goto(base+'/pages/p01/');
  await user.getByText('真实入口邀请联调合成Study',{exact:false}).first().waitFor();
  await user.screenshot({path:out+'invitee-p01-new-study.png',fullPage:true});
  checks.push('p01-shows-real-invited-study');
  stage='safe-video';
  const videoContext=await browser.newContext({storageState:await userContext.storageState(),viewport:{width:390,height:844},recordVideo:{dir:out+'invite-video',size:{width:390,height:844}},reducedMotion:'reduce'});
  const videoPage=await videoContext.newPage();
  await videoPage.goto(base+scoped);
  await videoPage.getByText('当前为该Study最小只读身份，没有邀请或成员管理权限。',{exact:true}).waitFor();
  const mobile=await videoPage.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
  assert(mobile.scrollWidth<=mobile.width+1,'MOBILE_HORIZONTAL_OVERFLOW');
  await videoPage.screenshot({path:out+'invitee-new-study-mobile.png',fullPage:true});
  await videoPage.getByText('当前为该Study最小只读身份，没有邀请或成员管理权限。',{exact:true}).scrollIntoViewIfNeeded();
  await videoPage.screenshot({path:out+'invitee-new-study-mobile-bottom.png'});
  await videoContext.close();
  await videoPage.video()?.saveAs(out+'invitee-mobile.webm');
  assert.deepEqual(errors,[]);
  const modelRequests=requests.filter(item=>item.method==='POST'&&/(agent|chat|inference|completion|\/ai(?:\/|$))/i.test(item.path));
  assert.equal(modelRequests.length,0,'INVITATION_MUST_NOT_CALL_AI');
  const result={at:new Date().toISOString(),passed:true,environment:'local-synthetic-only',fixtureRunKey:fixture.runKey,checks,persistedMilestones:{invited:state.invited===true,accepted:state.accepted===true},receipt,noOutboundMail:true,newAiCalls:modelRequests.length,requests,errors};
  writeFileSync(out+'invitation-result-'+randomUUID().slice(0,8)+'.json',JSON.stringify(result,null,2),{flag:'wx'});
  writeFileSync(out+'invitation-result.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify({passed:true,checks:checks.length,capturedMail:1,newAiCalls:0}));
}catch(error){
  const safePath=page=>{try{return new URL(page.url()).pathname;}catch{return 'unavailable';}};
  writeFileSync(out+'invitation-failure.json',JSON.stringify({at:new Date().toISOString(),passed:false,stage,kind:error?.name??'Error',adminPath:safePath(admin),userPath:safePath(user),scopeStatuses,checks,requests,errors},null,2));
  throw new Error('REAL_INVITATION_BROWSER_FAILED_AT:'+stage);
}finally{await adminContext.close();await userContext.close();await browser.close();}
