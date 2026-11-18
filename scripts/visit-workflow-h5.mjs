// New-scope native invitation -> actual loopback SMTP -> real H5 browser. Never uses env.prod SMTP.
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {existsSync,readFileSync,chmodSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {privateDir,evidenceDir,workspace,purpose,base,json,save,requireQAWindow,validateFixture,localMailerTarget} from './visit-workflow-qa.mjs';
import {preserveOld} from './visit-workflow-preserve.mjs';

export async function runH5(){
 requireQAWindow(['--local-synthetic','--h5']);
 const{openHarness,key}=await import('./full-study-runtime.mjs'),{runtimeDependencies}=await import('../server/research-runtime/dependencies.mjs'),{createSimulationStudyMailer}=await import('../server/research-simulation/delivery.mjs');
 const h=await openHarness({privateOutputDir:privateDir+'h5-auth/'}),f=json(privateDir+'fixture.json');validateFixture(f);assert(f.ready);await preserveOld(h,'before-h5');
 await h.read(async tx=>{const[row]=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${f.runId}`;assert(row?.manifest?.syntheticOnly===true&&row.manifest.purpose===purpose&&row.manifest.studyId===f.study.id);});
 const item=f.cases.H5,visitId=item.channelVisitId,root='/research-studies/'+f.study.id,tokenPath=privateDir+'h5-invitation.json';
 if(!existsSync(tokenPath)){
  const pendingPath=privateDir+'h5-preparation-pending.json';assert(!existsSync(pendingPath),'H5_PREPARATION_UNCONFIRMED_DO_NOT_MINT_ANOTHER');
  const visit=(await h.get(root+'/visits/'+visitId)).visit;assert(visit.assignments.every(a=>a.formVersionId!==f.refs.phq),'H5_TARGET_ALREADY_ASSIGNED');
  save(pendingPath,{at:new Date().toISOString(),studyId:f.study.id,visitId,step:'start'},true);
  if(visit.capabilities.canStart)await h.post(root+'/visits/'+visitId+'/start',{requestKey:key(),expectedVersion:visit.version});
  const {load}=runtimeDependencies(),core={register:load('study-operations/formal-outreach','registerEmailRecipientInTransaction'),prepare:load('study-operations/formal-outreach','prepareEmailInvitationInTransaction'),send:load('study-operations/formal-outreach','sendEmailInvitationInTransaction')};
  const user={accountId:h.actor.id,tenantId:h.actor.tenantId,authVersion:h.actor.authVersion,role:h.actor.role,isTenantAdmin:true},oldKey=process.env.CONTACT_ENCRYPTION_KEY;process.env.CONTACT_ENCRYPTION_KEY=createHmac('sha256',h.runtime.secret).update('researchhub:local-contact:v1').digest('hex');
  let invitation,receipt,token,messageId;
  const capture=async id=>{const path=workspace+'.tmp/researchhub-wp02/mail/'+id+'.json';return existsSync(path)?json(path):null;},mailer=createSimulationStudyMailer({targets:[{studyId:f.study.id,caseId:f.runId+'-case'}],receipt:capture});
  try{
   await h.direct(async tx=>{
    const participant=await core.register(tx,user,f.scope,{visitId,address:f.runId+'-h5@example.test',emailConsentConfirmed:true});invitation=await core.prepare(tx,user,f.scope,{visitId,formVersionId:f.refs.phq,participantId:participant.participantId});
    receipt=await core.send(tx,user,f.scope,invitation.capability,async(address,value)=>{token=value;const message={studyId:f.study.id,address,invitationUrl:base+'/h5/questionnaire/'+value};localMailerTarget(f,message);save(pendingPath,{at:new Date().toISOString(),studyId:f.study.id,visitId,step:'local-send-attempting',token,assignmentId:invitation.assignmentId,invitationId:invitation.invitationId});const delivered=await mailer(message);messageId=delivered.providerMessageId;save(pendingPath,{at:new Date().toISOString(),studyId:f.study.id,visitId,step:'local-send-returned-awaiting-transaction',token,assignmentId:invitation.assignmentId,invitationId:invitation.invitationId,messageId,deliveryStatus:delivered.status});return delivered;});
    await tx.auditLog.createMany({data:{id:f.runId+'-h5-loopback-proof',...f.scope,accountId:h.actor.id,action:'synthetic_fixture.visit_workflow.h5.loopback',target:invitation.invitationId,meta:{runId:f.runId,purpose,actualLoopbackSmtp:true,publicOutreachTransportRetested:false,externalEmailSent:false,messageId}}});
   });
  }finally{if(oldKey===undefined)delete process.env.CONTACT_ENCRYPTION_KEY;else process.env.CONTACT_ENCRYPTION_KEY=oldKey;}
  assert(typeof token==='string'&&/^[A-Za-z0-9_-]+$/.test(token));const message=await capture(messageId);assert(message?.to===f.runId+'-h5@example.test'&&message.text.includes(base+'/h5/questionnaire/'+token));
  save(tokenPath,{studyId:f.study.id,visitId,token,assignmentId:invitation.assignmentId,invitationId:invitation.invitationId,messageId},true);item.assignmentId=invitation.assignmentId;item.invitationId=invitation.invitationId;save(privateDir+'fixture.json',f);
  save(evidenceDir+'h5-transport.json',{at:new Date().toISOString(),passed:true,studyId:f.study.id,visitId,assignmentId:invitation.assignmentId,invitationId:invitation.invitationId,messageId,messageDigest:message.digest,receipt,actualLoopbackSmtp:true,smtpHost:'127.0.0.1',smtpPort:19506,publicOutreachTransportRetested:false,externalEmailSent:false,qualification:'Native invitation creation with explicitly case-bound loopback SMTP callback; production-configured public SMTP path was not invoked or modified.'});
 }
 const invitation=json(tokenPath);assert.equal(invitation.studyId,f.study.id);assert.equal(invitation.visitId,visitId);
 const{chromium}=createRequire('/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
 const out=evidenceDir+'h5-browser/',storagePath=privateDir+'h5-storage-state.json',browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),network=[],errors=[];let context;
 const redact=v=>String(v).split(invitation.token).join('[redacted]');
 try{
  context=await browser.newContext({viewport:{width:390,height:844},...(existsSync(storagePath)?{storageState:storagePath}:{}),recordVideo:{dir:out+'video'}});const page=await context.newPage();page.on('pageerror',e=>errors.push(redact(e.message)));page.on('response',r=>{const u=new URL(r.url());if(u.pathname.startsWith('/api/'))network.push({method:r.request().method(),path:redact(u.pathname),status:r.status()});});
  await page.goto(base+'/h5/questionnaire/'+invitation.token);await page.locator('.fc-field-editor,.fc-answers').first().waitFor();await context.storageState({path:storagePath});chmodSync(storagePath,0o600);
  if(await page.locator('.fc-field-editor').count()){
   const editor=page.locator('.fc-field-editor');for(let i=0;i<9;i++)await editor.locator('fieldset').nth(i).locator('input[type=radio]').nth(f.answers.phq['phq9_q'+(i+1)]).check();await editor.locator('select').selectOption(f.answers.phq.functional_difficulty);
   await page.screenshot({path:out+'01-phq9-filled.png',fullPage:true});const submit=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname.endsWith('/session/submit'));await page.getByRole('button',{name:'提交问卷',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'确认提交',exact:true}).click();assert.equal((await submit).status(),200);await page.getByText('已提交，感谢完成。',{exact:true}).waitFor();
  }
  await context.storageState({path:storagePath});chmodSync(storagePath,0o600);await page.reload();await page.locator('.fc-answers').waitFor();assert.equal(await page.getByText('已提交，感谢完成。',{exact:true}).count(),1);await page.screenshot({path:out+'02-phq9-submitted-readback.png',fullPage:true});assert.deepEqual(errors,[]);
  const capture=await h.get(root+'/assignments/'+invitation.assignmentId);assert.equal(capture.assignment.mode,'patient_h5');assert.deepEqual(capture.response.answers,f.answers.phq);assert.equal(capture.response.status,'submitted');f.cases.H5.assignmentId=invitation.assignmentId;save(privateDir+'fixture.json',f);
  save(out+'result.json',{at:new Date().toISOString(),passed:true,studyId:f.study.id,visitId,assignmentId:invitation.assignmentId,currentRef:capture.response.ref,mode:capture.assignment.mode,actualLoopbackSmtp:true,publicOutreachTransportRetested:false,externalEmailSent:false,network,errors,submitCount:network.filter(x=>x.method==='POST'&&x.path.endsWith('/session/submit')).length});
 }catch(e){save(out+'failure.json',{at:new Date().toISOString(),passed:false,error:redact(e.message),network,errors});throw Error(redact(e.message));}finally{if(context)await context.close();await browser.close();}
 await preserveOld(h,'after-h5-browser');console.log(JSON.stringify({passed:true,studyId:f.study.id,visitId,assignmentId:invitation.assignmentId,actualLoopbackSmtp:true,externalEmailSent:false,evidence:out+'result.json'}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){assert.equal(requireQAWindow(process.argv.slice(2)),'h5');await runH5();}
