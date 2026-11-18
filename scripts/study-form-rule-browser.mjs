// Real Chrome read-only history verification for the user-confirmed policy snapshot.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {json,privateDir,evidenceDir,base} from './study-form-rule-runtime.mjs';
assert.deepEqual(process.argv.slice(2),['--local-synthetic']);
const fixture=json(privateDir+'rule-fixture.json'),result=json(evidenceDir+'rule-http-result.json'),auth=json(privateDir+'admin-session.json');
assert(fixture.syntheticOnly&&fixture.projectOperatingPolicyUserConfirmed&&result.passed);assert.equal(result.studyId,fixture.study.id);
const out=evidenceDir+'browser/';mkdirSync(out,{recursive:true});
const {chromium}=createRequire('/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out+'video'}}),checks=[],network=[],errors=[],screenshots=[];
try{
 const cookie=auth.cookie.split(';')[0],pos=cookie.indexOf('=');await context.addCookies([{name:cookie.slice(0,pos),value:cookie.slice(pos+1),domain:'127.0.0.1',path:'/api',httpOnly:true,sameSite:'Lax'}]);
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))network.push({at:new Date().toISOString(),method:r.request().method(),path:new URL(r.url()).pathname,status:r.status()});});
 for(const item of result.results){
  const ref=item.revision.ref,query=new URLSearchParams({formalCapture:'1',studyId:fixture.study.id,visitId:fixture.visitId,assignmentId:fixture.assignmentId,responseId:ref.responseId,revisionNo:String(ref.revisionNo),contentHash:ref.contentHash});
  await page.goto(base+'/pages/s09/?'+query);const history=page.locator('.fc-historical');await history.waitFor();
  assert.equal(await history.locator('h4').innerText(),'正在核对第'+ref.revisionNo+'次修订');
  const text=await history.innerText();assert.equal(await history.locator('.fc-answers dd').count(),fixture.profile.schema.fields.length);
  for(const field of fixture.profile.schema.fields)assert(text.includes(field.label));
  if(item.name==='positive'){assert(text.includes('总分24'));assert(text.includes('本量表判定：符合'));assert(!text.includes('待规则确认'));}
  else if(item.name==='not_applicable'){assert(text.includes('资料不完整，未计算总分'));assert(text.includes('月经不调：不适用'));assert(!text.includes('本量表判定：符合'));}
  else{assert(text.includes('脉象需复核，未计算总分'));assert(!text.includes('本量表判定：符合'));}
  await history.scrollIntoViewIfNeeded();const screenshot=out+item.name+'-fixed-revision.png';await page.screenshot({path:screenshot,fullPage:true});screenshots.push(screenshot);
  const width=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth}));assert(width.scroll<=width.viewport+1);
  checks.push({name:item.name,ref,originalLabels:true,scoreStateMatches:true,noHorizontalOverflow:true});
 }
 assert.deepEqual(errors,[]);assert(network.every(r=>r.status<400));
 writeFileSync(out+'result.json',JSON.stringify({passed:true,at:new Date().toISOString(),syntheticOnly:true,projectOperatingPolicyUserConfirmed:true,realStudyEnabled:false,studyId:fixture.study.id,checks,network,errors,screenshots,mode:'real Chrome read-only three immutable revisions; HTTP writes and PostgreSQL rehash verified separately',policyVersion:fixture.policyVersion},null,2)+'\n');
 console.log(JSON.stringify({passed:true,checks:checks.length,evidence:out+'result.json'}));
}catch(error){writeFileSync(out+'failure.json',JSON.stringify({passed:false,message:error.message,checks,network,errors},null,2));throw error;}
finally{await context.close();await browser.close();}
