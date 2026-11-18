// Free component/browser contract; not a real-backend AI acceptance.
import assert from 'node:assert/strict';import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createServer} from 'vite';
const root='/Users/mac/aisciencesys/',out='.tmp/ai-file-data-2026-11-12/p03-ui-'+Date.now(),base='http://127.0.0.1:19612';mkdirSync(out+'/video',{recursive:true,mode:0o700});
const vite=await createServer({root:root+'researchhub',configFile:root+'researchhub/vite.config.js',cacheDir:mkdtempSync(join(tmpdir(),'rh-material-p03-')),build:{outDir:root+'researchhub/'+out+'/unused-build'},server:{host:'127.0.0.1',port:19612,strictPort:true},logLevel:'error'});await vite.listen();
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out+'/video'}}),errors=[],results=[];let passed=false;
try{
 await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
 const page=await context.newPage();page.on('pageerror',e=>errors.push({type:'pageerror',message:e.message}));page.on('console',m=>{if(['error','warning'].includes(m.type()))errors.push({type:m.type(),message:m.text().slice(0,400)});});
 for(const [name,flags,blocked]of [['ready','analysis',false],['parsing','analysis&parsing',false],['warning','analysis&warning',true],['old-backend','',true]]){
  await page.goto(base+'/scripts/fixtures/agent-material-state-harness.html?'+flags);await page.locator('.agent-materials li').waitFor();await page.waitForFunction(expected=>document.querySelector('#analysis-blocked').textContent===String(expected),blocked);
  results.push({name,blocked:await page.locator('#analysis-blocked').innerText()});
 }
 await page.goto(base+'/scripts/fixtures/agent-material-state-harness.html?analysis&deferRead');await page.waitForFunction(()=>typeof window.materialHarness.resolveRead==='function');assert.equal(await page.locator('#analysis-blocked').innerText(),'true');await page.evaluate(()=>window.materialHarness.resolveRead());await page.waitForFunction(()=>document.querySelector('#analysis-blocked').textContent==='false');results.push({name:'unread-keeps-block',passed:true});
 await page.goto(base+'/scripts/fixtures/agent-material-state-harness.html?analysis&sources');await page.locator('.private-material-sources>summary').click();await page.getByText('原文 · 第1–5行',{exact:true}).click();await page.getByText(/P03-SOURCE:/).waitFor();
 const href=await page.getByRole('link',{name:'查看原资料',exact:true}).getAttribute('href');assert(href.includes('docId=source-doc')&&href.includes('kbId=base'));
 const style=await page.locator('.private-material-sources pre').evaluate(node=>({fontSize:getComputedStyle(node).fontSize,lineHeight:getComputedStyle(node).lineHeight}));assert.deepEqual(style,{fontSize:'16px',lineHeight:'28px'});
 await page.screenshot({path:out+'/fixed-source.png'});results.push({name:'fixed-source-location-and-style',style,href});assert.deepEqual(errors,[]);passed=true;
}catch(e){console.error(JSON.stringify({passed:false,code:e.code??e.name??'BROWSER_FAILED',evidence:out}));process.exitCode=1;}
finally{await context.close();await browser.close();await vite.close();writeFileSync(out+'/result.json',JSON.stringify({passed,results,errors,modelCalls:0,backendAcceptance:false},null,2),{mode:0o600});console.log(JSON.stringify({passed,evidence:out,cases:results.length,errors:errors.length,modelCalls:0,backendAcceptance:false}));}
