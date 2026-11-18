// Bounded, explicitly approved 2026-11-14 fixture and real-browser acceptance.
// No production behavior/configuration is modified. Never prints cookies or mail tokens.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {readWp02Config} from '../server/wp02/config.mjs';
import {invitationLocationHref} from '../src/invitation-location.js';

const mode=process.argv[2];
assert(['--preflight','--prepare-approved-four','--browser-approved-four','--verify-approved-four'].includes(mode));
const root=new URL('../../',import.meta.url).pathname,base='http://127.0.0.1:19501';
const rt=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const fixture=JSON.parse(readFileSync(root+'.tmp/researchhub-p2/fixture.json'));
const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
assert.equal(rt.ids.tenant,'rh-kb-local-b0e2af9d-tenant');
assert.equal(fixture.tenantId,rt.ids.tenant);assert.equal(fixture.groupId,'rh-p2-20261113-group');assert.equal(fixture.projectId,'rh-p2-20261113-project');
const mailConfig=readWp02Config({file:root+'researchhub/.env.smtp.local',approvedMode:'capture'});
assert.equal(mailConfig.smtpHost,'127.0.0.1');assert.equal(mailConfig.smtpPort,19506);
const privateDir=root+'.tmp/researchhub-invitation-exceptions-20261114/';
const manifestPath=privateDir+'approved-four.json';
const evidence=root+'researchhub/docs/testing/evidence/invitation-exceptions-2026-11-13/approved-four-2026-11-14/';
const scope={'X-Study-Group-Id':fixture.groupId,'X-Research-Project-Id':fixture.projectId};
let manifest=existsSync(manifestPath)?JSON.parse(readFileSync(manifestPath)):null;
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const save=()=>{writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n',{mode:0o600});};
const publicSave=(name,value)=>{mkdirSync(evidence,{recursive:true});writeFileSync(evidence+name,JSON.stringify(value,null,2)+'\n');};
const dbRead=fn=>withFixtureTransaction(env,'direct',fn,{readOnly:true});
async function snapshot(tx){
 const inv=await tx.$queryRaw`SELECT * FROM research_member_invitation WHERE "tenantId"=${rt.ids.tenant} ORDER BY id`;
 const accounts=await tx.account.findMany({where:{tenantId:rt.ids.tenant,id:{in:[rt.ids.admin,rt.ids.owner]}},orderBy:{id:'asc'},select:{id:true,tenantId:true,role:true,isTenantAdmin:true,status:true,authVersion:true}});
 const roles=await tx.permissionRole.findMany({where:{tenantId:rt.ids.tenant},orderBy:{id:'asc'}});
 const groupMembers=await tx.studyGroupMembership.findMany({where:{tenantId:rt.ids.tenant,studyGroupId:fixture.groupId},orderBy:{id:'asc'}});
 const members=await tx.researchProjectMembership.findMany({where:{tenantId:rt.ids.tenant,researchProjectId:fixture.projectId},orderBy:{id:'asc'}});
 return{invitations:Object.fromEntries(inv.map(x=>[x.id,hash(x)])),accounts:hash(accounts),roles:hash(roles),groupMembers:hash(groupMembers),members:hash(members)};
}
async function rows(){return dbRead(tx=>tx.$queryRaw`SELECT id,email,version,"deliveryStatus","createdAt","expiresAt","updatedAt","messageId","messageDigest","revokedAt","acceptedAt","lastRequestKey" FROM research_member_invitation WHERE "tenantId"=${rt.ids.tenant} AND "studyGroupId"=${fixture.groupId} AND "researchProjectId"=${fixture.projectId} AND "requestKey" LIKE ${'invite-exceptions-20261114-%'} ORDER BY id`);}
async function preflight(){
 return dbRead(async tx=>{
  const [d]=await tx.$queryRaw`SELECT current_database() AS name`;assert.equal(d.name,'wp01_test_full_baseline');
  const admin=await tx.account.findFirst({where:{id:rt.ids.admin,tenantId:rt.ids.tenant,status:'active'},select:{role:true,isTenantAdmin:true}});
  assert.equal(admin.role,'tenant_admin');assert.equal(admin.isTenantAdmin,true);
  assert(await tx.researchProject.findFirst({where:{id:fixture.projectId,studyGroupId:fixture.groupId,tenantId:rt.ids.tenant,status:'active'}}));
  return{database:d.name,adminCurrent:true,localCapture:true,existingNamedRows:(await tx.$queryRaw`SELECT count(*)::int AS n FROM research_member_invitation WHERE "tenantId"=${rt.ids.tenant} AND "requestKey" LIKE ${'invite-exceptions-20261114-%'}`)[0].n};
 });
}
async function login(c){const r=await c.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:rt.ids.tenant,username:'admin@example.org',password:rt.password}});assert.equal(r.status(),201);}
async function api(c,path,body){const r=await c.request[body?'post':'get'](base+'/api'+path,{headers:{Origin:base,...scope,...(body?{'X-ResearchHub-Request':'session-v1'}:{})},...(body?{data:body}:{})});let value;try{value=await r.json();}catch{throw Error('NON_JSON_RESPONSE_'+r.status());}assert(r.ok(),'API_'+r.status()+'_'+(value.code??''));return value;}
async function verify(){
 assert(manifest?.prepared);const snapshotAfter=await dbRead(snapshot),owned=await rows();assert.equal(owned.length,4);
 for(const [id,digest]of Object.entries(manifest.baseline.invitations))assert.equal(snapshotAfter.invitations[id],digest,'OLD_INVITATION_CHANGED_'+id);
 const extras=Object.keys(snapshotAfter.invitations).filter(id=>!Object.hasOwn(manifest.baseline.invitations,id));assert.deepEqual(extras.sort(),manifest.items.map(x=>x.id).sort());
 for(const key of ['accounts','roles','groupMembers','members'])assert.equal(snapshotAfter[key],manifest.baseline[key],key+'_CHANGED');
 const audits=await dbRead(tx=>tx.auditLog.findMany({where:{tenantId:rt.ids.tenant,target:{in:manifest.items.map(x=>x.id)}},orderBy:{createdAt:'asc'},select:{action:true,target:true,createdAt:true,meta:true}}));
 const captures=readdirSync(root+'.tmp/researchhub-wp02/mail/').filter(x=>/^[A-Za-z0-9-]{8,100}\.json$/.test(x)&&x!=='inbox-credentials.json').map(f=>JSON.parse(readFileSync(root+'.tmp/researchhub-wp02/mail/'+f))).filter(x=>manifest.items.some(i=>i.email===x.to)).map(({id,to,purpose,capturedAt,digest})=>({id,to,purpose,capturedAt,digest}));
 assert.equal(captures.length,manifest.items.reduce((n,x)=>n+1+(x.action?.operation==='resend'&&x.action?.result?1:0),0));
 for(const item of manifest.items){
  const row=owned.find(x=>x.id===item.id),ownAudits=audits.filter(x=>x.target===item.id),ownCaptures=captures.filter(x=>x.to===item.email);
  assert.equal(ownAudits.filter(x=>x.action==='wp02_member_invitation_issued').length,1);
  assert.equal(ownAudits.filter(x=>x.action==='researchhub_synthetic_invitation_exception_fixture').length,1);
  if(item.action?.result){assert.equal(ownAudits.filter(x=>x.action==='wp02_member_invitation_'+item.action.operation).length,1);assert.equal(row.version,item.seedVersion+(item.action.operation==='resend'?2:1));if(item.action.operation==='resend'){assert.equal(row.deliveryStatus,'captured');assert(ownCaptures.some(x=>x.id===row.messageId&&x.digest===row.messageDigest));}else assert(row.revokedAt);}
  else {assert.equal(row.version,item.seedVersion);assert.equal(item.state,'captured');}
  assert.equal(ownCaptures.length,item.action?.operation==='resend'&&item.action.result?2:1);assert(!row.acceptedAt);
 }
 const result={passed:true,time:new Date().toISOString(),presentationDate:'2026-11-14',database:'wp01_test_full_baseline',newInvitations:4,oldInvitationHashesUnchanged:Object.keys(manifest.baseline.invitations).length,accountsRolesMembershipsUnchanged:true,captureOnlyMessages:captures.length,items:owned.map(({messageId,messageDigest,...x})=>x),audits:audits.map(({meta,...x})=>x),captures,externalMail:0,modelCalls:0};
 publicSave('final-database-and-capture.json',result);return result;
}
const state=await preflight();
if(mode==='--preflight'){console.log(JSON.stringify(state));process.exit(0);}
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser=await (pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
let context,p;const result={time:new Date().toISOString(),presentationDate:'2026-11-14',checks:[],writes:[],pageErrors:[],blocked:[],modelRequests:[]};
try{
 if(mode==='--prepare-approved-four'){
  if(!manifest){assert.equal(state.existingNamedRows,0);mkdirSync(privateDir,{recursive:true,mode:0o700});manifest={authorization:'user-approved-four-2026-11-14',tenantId:rt.ids.tenant,groupId:fixture.groupId,projectId:fixture.projectId,baseline:await dbRead(snapshot),items:['failed','unknown','expired','captured'].map(state=>({state,email:'invite-exceptions-20261114-'+state+'@example.test',requestKey:'invite-exceptions-20261114-'+state}))};writeFileSync(manifestPath,JSON.stringify(manifest,null,2),{mode:0o600,flag:'wx'});}
  assert.equal(manifest.items.length,4);context=await browser.newContext();await login(context);
  for(const item of manifest.items){
   if(item.id)continue;
   if(item.issueAttemptedAt){const found=await dbRead(tx=>tx.$queryRaw`SELECT id,"deliveryStatus" FROM research_member_invitation WHERE "tenantId"=${rt.ids.tenant} AND "issuedBy"=${rt.ids.admin} AND "requestKey"=${item.requestKey}`);assert.equal(found.length,1,'UNKNOWN_ISSUE_RESULT_STOP');assert.equal(found[0].deliveryStatus,'captured');item.id=found[0].id;save();continue;}
   item.issueAttemptedAt=new Date().toISOString();save();const issued=await api(context,'/member-invitations',{email:item.email,requestKey:item.requestKey});assert.equal(issued.deliveryStatus,'captured');item.id=issued.id;item.issueResult=issued;save();
  }
  if(!manifest.prepared){
   await new Promise(ok=>setTimeout(ok,1500));
   const seed=await withFixtureTransaction(env,'direct',async tx=>{
    const a=await tx.account.findFirst({where:{id:rt.ids.admin,tenantId:rt.ids.tenant,status:'active'},select:{role:true,isTenantAdmin:true}});assert(a?.role==='tenant_admin'&&a.isTenantAdmin);
    const seeded=[];
    for(const item of manifest.items){const [row]=await tx.$queryRaw`SELECT * FROM research_member_invitation WHERE id=${item.id} AND "tenantId"=${rt.ids.tenant} AND "studyGroupId"=${fixture.groupId} AND "researchProjectId"=${fixture.projectId} AND "requestKey"=${item.requestKey} FOR UPDATE`;assert(row);assert.equal(row.version,2);assert.equal(row.deliveryStatus,'captured');assert(!row.acceptedAt&&!row.revokedAt);
     const expires=item.state==='expired'?new Date(row.createdAt.getTime()+1000):row.expiresAt;assert(item.state!=='expired'||expires<new Date());
     await tx.$executeRaw`UPDATE research_member_invitation SET "deliveryStatus"=${['failed','unknown'].includes(item.state)?item.state:'captured'},"expiresAt"=${expires},"messageId"=${['failed','unknown'].includes(item.state)?null:row.messageId},"messageDigest"=${['failed','unknown'].includes(item.state)?null:row.messageDigest},version=version+1 WHERE id=${item.id} AND "tenantId"=${rt.ids.tenant} AND version=2`;
     await tx.auditLog.create({data:{tenantId:rt.ids.tenant,studyGroupId:fixture.groupId,researchProjectId:fixture.projectId,accountId:rt.ids.admin,action:'researchhub_synthetic_invitation_exception_fixture',target:item.id,meta:{syntheticOnly:true,notProviderFailure:true,originalCapturedReceiptPreservedInPrivateInbox:true,fixtureState:item.state,authorization:'approved-four-2026-11-14'}}});seeded.push({id:item.id,seedVersion:3});
    }return seeded;
   });for(const x of seed)Object.assign(manifest.items.find(i=>i.id===x.id),x);manifest.prepared=true;save();
  }
  publicSave('fixture-prepared.json',{...state,approved:true,newInvitations:manifest.items.map(({id,state,email,seedVersion})=>({id,state,email,seedVersion})),syntheticStatesNotProviderFailure:true,oldInvitationsUntouched:true,mailMode:'loopback-capture'});console.log(JSON.stringify({prepared:true,count:4,evidence}));
 }else if(mode==='--verify-approved-four'){
  const v=await verify();console.log(JSON.stringify({verified:v.passed,oldInvitationsUnchanged:v.oldInvitationHashesUnchanged,capturedMessages:v.captureOnlyMessages}));
 }else{
  assert(manifest?.prepared);assert(manifest.items.every(x=>!x.action),'ACTION_ALREADY_STARTED_USE_RECEIPT_NOT_RETRY');mkdirSync(evidence+'video',{recursive:true});
  context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:evidence+'video',size:{width:1440,height:900}}});await login(context);
  context.on('page',page=>{page.on('pageerror',e=>result.pageErrors.push(e.message));page.on('dialog',async d=>{result.blocked.push('native-dialog');await d.dismiss();});});
  let allowed=null;
  await context.route('**/api/**',async r=>{const u=new URL(r.request().url()),path=u.pathname,method=r.request().method();
   if(!['GET','OPTIONS'].includes(method)&&!path.startsWith('/api/auth/')){
    if(/agent|chat|jobs|sessions/.test(path))result.modelRequests.push(path);
    const match=path.match(/^\/api\/member-invitations\/([A-Za-z0-9-]+)\/(resends|revocations)$/);
    if(!match||!allowed||allowed.id!==match[1]||allowed.operation!==(match[2]==='resends'?'resend':'revoke')||allowed.sent){result.blocked.push({path,method});return r.abort();}
    assert.equal(r.request().headers()['x-study-group-id'],fixture.groupId);assert.equal(r.request().headers()['x-research-project-id'],fixture.projectId);
    allowed.sent=true;const payload=r.request().postDataJSON();allowed.requestKey=payload.requestKey;allowed.requestVersion=payload.baseVersion;save();result.writes.push({id:allowed.id,operation:allowed.operation,requestKey:payload.requestKey,baseVersion:payload.baseVersion});
   }await r.continue();
  });
  p=await context.newPage();
  async function overview(expected){await p.goto(base+'/pages/g02/?governanceModule=access&governanceAttentionPage=1');await p.waitForFunction(()=>document.querySelector('.governance-queue')?.getAttribute('aria-busy')==='false');await p.locator('.governance-attention summary').waitFor();const text=await p.locator('.governance-attention').innerText();assert(!text.includes('暂时读取失败'));for(const i of manifest.items)assert.equal(text.includes(i.email),expected.includes(i.state),i.state+'_OVERVIEW');assert.equal(await p.locator('.governance-attention .governance-items li').count(),expected.length);return text;}
  await overview(['failed','unknown','expired']);await p.screenshot({path:evidence+'overview-three-exceptions.png'});result.checks.push('actual API/PG has exactly three exceptions; normal captured invitation excluded');
  for(const width of [1440,1366,1920,390,320]){await p.setViewportSize({width,height:900});await p.waitForTimeout(350);await p.locator('.governance-attention').scrollIntoViewIfNeeded();const m=await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert(m.scroll<=m.width+1);await p.screenshot({path:evidence+'overview-'+width+'.png'});}await p.setViewportSize({width:1440,height:900});result.checks.push('real three-exception overview verified at five widths');
  const expected=['failed','unknown','expired'];
  for(const item of manifest.items.filter(x=>x.state!=='captured')){
   const link=p.locator('.governance-attention li').filter({hasText:item.email}).getByRole('link',{name:/查看邀请/});const href=await link.getAttribute('href');assert.equal(new URL(href,base).searchParams.get('invitationId'),item.id);await link.click();const row=p.locator('#invitation-'+item.id);await row.waitFor();assert.equal(await row.getAttribute('data-invitation-selected'),'true');assert(await row.evaluate(e=>e===document.activeElement));assert.equal(await p.getByLabel('选择已授权Study').inputValue(),fixture.groupId+'|'+fixture.projectId);await p.screenshot({path:evidence+item.state+'-exact-target.png'});
   const op=item.state==='unknown'?'revoke':'resend';
   if(op==='resend'){const button=row.getByRole('button',{name:'显式重发',exact:true});let waiting=0;while(await button.isDisabled()){assert(waiting<75,'RESEND_WAIT_EXCEEDED');await p.waitForTimeout(15000);waiting+=15;console.log(JSON.stringify({waitingForOriginalResendCooldownSeconds:waiting,state:item.state}));}}
   else {await row.getByRole('button',{name:'撤销邀请',exact:true}).click();const dialog=p.getByRole('dialog',{name:'撤销邀请'});await dialog.waitFor();await p.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.equal(result.writes.length,1);await row.getByRole('button',{name:'撤销邀请',exact:true}).click();await dialog.waitFor();}
   item.action={id:item.id,operation:op,attemptedAt:new Date().toISOString()};allowed=item.action;save();
   const response=p.waitForResponse(r=>new URL(r.url()).pathname==='/api/member-invitations/'+item.id+(op==='resend'?'/resends':'/revocations')&&r.request().method()==='POST');
   await (op==='resend'?row.getByRole('button',{name:'显式重发',exact:true}):p.getByRole('dialog',{name:'撤销邀请'}).getByRole('button',{name:'撤销邀请',exact:true})).click();const responseValue=await response;assert.equal(responseValue.status(),200);item.action.result=await responseValue.json();save();allowed=null;
   assert.equal(item.action.result.status,op==='resend'?'captured':'revoked');await row.getByText(op==='resend'?'体验邮件已收取 · 待接受':'已撤销',{exact:false}).waitFor();await p.getByRole('button',{name:'刷新邀请状态',exact:true}).click();await row.waitFor();assert((await row.innerText()).includes(op==='resend'?'体验邮件已收取':'已撤销'));await p.screenshot({path:evidence+item.state+'-handled.png'});
   await p.getByRole('link',{name:'返回治理总览',exact:true}).click();await p.waitForURL('**/pages/g02/**');expected.splice(expected.indexOf(item.state),1);await overview(expected);await p.screenshot({path:evidence+'overview-after-'+item.state+'.png'});result.checks.push(item.state+' exact original row '+op+' once; real API200; refresh persists; overview removes only that exception');
  }
  assert.equal(result.writes.length,3);assert.deepEqual(result.pageErrors,[]);assert.deepEqual(result.blocked,[]);assert.deepEqual(result.modelRequests,[]);
  result.database=await verify();result.checks.push('all four records persisted; old invitations/accounts/roles/members unchanged; six local capture receipts and original audits verified');result.passed=true;publicSave('browser-result.json',result);manifest.browserPassed=true;save();console.log(JSON.stringify({passed:true,checks:result.checks.length,writes:3,evidence}));
 }
}catch(e){result.passed=false;result.error=e.message;publicSave('failure-'+Date.now()+'.json',result);await p?.screenshot({path:evidence+'failure.png'}).catch(()=>{});console.error(JSON.stringify({passed:false,error:e.message,evidence}));process.exitCode=1;}
finally{await context?.close();await browser.close();}
