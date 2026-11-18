// Actual loopback SMTP receipt -> real Chrome H5 submission. No invitation creation here.
import assert from 'node:assert/strict';import {readFileSync,mkdirSync,existsSync,chmodSync} from 'node:fs';import {createRequire} from 'node:module';
import {openHarness,json,save,privateDir,evidenceDir} from './full-study-runtime.mjs';
assert.deepEqual(process.argv.slice(2),['--local-synthetic']);const h=await openHarness(),b=json(privateDir+'bootstrap.json'),journal=json(privateDir+'capture-V2-journal.json');assert.equal(journal.studyId,b.study.id);assert.equal(journal.h5Pending.length,4);
const tokenPath=privateDir+'v2-h5-private.json',out=evidenceDir+'h5-v2/';mkdirSync(out,{recursive:true});
let invitations=existsSync(tokenPath)?json(tokenPath).items:[];
if(!invitations.length){
 for(const pending of journal.h5Pending){
  assert(pending.address.startsWith(b.runId+'-')&&pending.address.endsWith('@example.test'));
  const sent=Object.values(journal.steps).find(s=>s.result?.assignmentId===pending.assignmentId&&s.url.endsWith('/email-invitations'));assert(sent?.result.delivery.status==='accepted');
  const delivery=await h.read(tx=>tx.messageDelivery.findFirst({where:{...b.scope,id:sent.result.delivery.id,invitationId:sent.result.invitationId},select:{id:true,status:true,providerMessageId:true}}));
  assert.equal(delivery.status,'sent');assert.match(delivery.providerMessageId,/^[A-Za-z0-9-]{8,100}$/,'CAPTURE_MESSAGE_ID_REQUIRED');
  const message=JSON.parse(readFileSync(new URL('../../.tmp/researchhub-wp02/mail/'+delivery.providerMessageId+'.json',import.meta.url),'utf8'));assert.equal(message.to,pending.address);
  const match=message.text.match(/http:\/\/127\.0\.0\.1:19501\/h5\/questionnaire\/([A-Za-z0-9_-]+)/);assert(match,'EXACT_H5_LINK_REQUIRED');
  invitations.push({...pending,token:match[1],deliveryId:delivery.id,messageId:message.id,digest:message.digest});
 }
 save(tokenPath,{studyId:b.study.id,items:invitations});
}
const {chromium}=createRequire('/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright'),browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),network=[],checks=[],errors=[];
const redact=value=>invitations.reduce((s,i)=>s.split(i.token).join('[redacted]'),String(value));
try{
 for(const item of invitations){
  const name=item.subjectId,storagePath=privateDir+'h5-'+name+'-state.json',context=await browser.newContext({viewport:{width:390,height:844},...(existsSync(storagePath)?{storageState:storagePath}:{}),recordVideo:{dir:out+'video'}});
  try{const page=await context.newPage();page.on('pageerror',e=>errors.push(redact(e.message)));page.on('response',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))network.push({subjectId:name,method:r.request().method(),path:redact(new URL(r.url()).pathname),status:r.status()});});
   await page.goto('http://127.0.0.1:19501/h5/questionnaire/'+item.token);
   await page.locator('.fc-field-editor,.fc-answers').first().waitFor();
   await context.storageState({path:storagePath});chmodSync(storagePath,0o600); // Preserve redeemed session before any submission/unknown network outcome.
   if(await page.locator('.fc-field-editor').count()){
    const editor=page.locator('.fc-field-editor');for(let i=0;i<9;i++)await editor.locator('fieldset').nth(i).locator('input[type=radio]').nth(item.answers['phq9_q'+(i+1)]).check();await editor.locator('select').selectOption(item.answers.functional_difficulty);
    await page.screenshot({path:out+name+'-filled.png',fullPage:true});const done=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname.endsWith('/session/submit'));
    await page.getByRole('button',{name:'提交问卷',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'确认提交',exact:true}).click();const response=await done;assert.equal(response.status(),200);await page.getByText('已提交，感谢完成。',{exact:true}).waitFor();
   }
   await context.storageState({path:storagePath});chmodSync(storagePath,0o600);await page.reload();await page.locator('.fc-answers').waitFor();assert.equal(await page.getByText('已提交，感谢完成。',{exact:true}).count(),1);assert.equal(await page.locator('.fc-answers dd').count(),10);await page.screenshot({path:out+name+'-submitted.png',fullPage:true});checks.push({subjectId:name,assignmentId:item.assignmentId,smtpMessageId:item.messageId,smtpDigest:item.digest,submitted:true,labelsReadBack:true});
  }finally{await context.close();}
 }
 assert.deepEqual(errors,[]);save(out+'result.json',{passed:true,at:new Date().toISOString(),studyId:b.study.id,syntheticOnly:true,checks,network,errors,actualLoopbackSmtp:true,externalEmailSent:false});console.log(JSON.stringify({passed:true,submissions:checks.length,evidence:out+'result.json'}));
}catch(error){save(out+'failure.json',{passed:false,message:redact(error.message),checks,network,errors});throw new Error(redact(error.message));}finally{await browser.close();}
