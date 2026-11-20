import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
const {chromium}=createRequire('/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
const base=process.env.RH_MEDIA_TEST_BASE??'http://127.0.0.1:19501',out='docs/testing/evidence/study-data-linkage-2026-11-19/media-ui';
test('acquisition defaults and original-result recovery use native targets in the real component',async t=>{
 mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try{
  await t.test('current visit is preselected, one confirmation returns to the actual registered visit',async()=>{
   const c=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'/visit'}}),p=await c.newPage();await c.route('**/api/**',r=>r.abort());
   try{await p.goto(base+'/scripts/fixtures/agent-media-ingest-harness.html?acquisition=visit');await p.getByRole('button',{name:'确认关联并登记',exact:true}).waitFor();assert.equal(await p.getByLabel('关联访视',{exact:true}).inputValue(),'visit');await p.getByRole('button',{name:'确认关联并登记',exact:true}).click();await p.getByText('登记成功',{exact:true}).waitFor();const link=p.getByRole('link',{name:'查看本次访视',exact:true});assert.equal(await link.getAttribute('href'),'/pages/s09/?formalCapture=1&studyId=study&visitId=visit#capture-files');const calls=await p.evaluate(()=>window.ingestHarness.data.calls.filter(x=>x[0]==='POST'));assert.equal(calls.length,2);assert.equal(calls[0][3].subjectVisitId,'visit');await p.screenshot({path:out+'/prefilled-visit.png'});await p.reload();await p.getByText('登记成功',{exact:true}).waitFor();assert.equal((await p.evaluate(()=>window.ingestHarness.data.calls.filter(x=>x[0]==='POST'))).length,2);}finally{await c.close();}
  });
  await t.test('a lost explicit visit cannot silently select another visit or post',async()=>{
   const c=await browser.newContext({recordVideo:{dir:out+'/rejected'}}),p=await c.newPage();await c.route('**/api/**',r=>r.abort());
   try{await p.goto(base+'/scripts/fixtures/agent-media-ingest-harness.html?acquisition=unavailable');await p.getByRole('alert').waitFor();const confirm=p.getByRole('button',{name:'确认关联并登记',exact:true});assert(await confirm.count()===0||!await confirm.isEnabled());assert.equal((await p.evaluate(()=>window.ingestHarness.data.calls.filter(x=>x[0]==='POST'))).length,0);await p.screenshot({path:out+'/lost-target.png'});}finally{await c.close();}
  });
 }finally{await browser.close();}
});
