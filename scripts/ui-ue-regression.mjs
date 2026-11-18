import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {pages}=JSON.parse(await readFile('platform-pages.json','utf8'));
const evidence=path.resolve('docs/testing/ui-ue-validation-2026-10-20/regression');
await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.UI_CHROMIUM_PATH||chromium.executablePath()});
const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:evidence,size:{width:1440,height:900}}});
const page=await context.newPage();
const rows=[];let errors=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
try{
  for(const entry of pages){
    errors=[];
    try{
      const response=await page.goto(`${process.env.UI_BASE_URL||'http://localhost:5173'}${entry.route}`);
      const portal=/^p00\d?$/.test(entry.id);
      if(!portal)await page.locator('.qiyan-platform-sidebar').waitFor();
      await page.evaluate(()=>document.fonts.ready);
      await page.waitForTimeout(150);
      const dom=await page.evaluate(()=>({
        headers:document.querySelectorAll('.global-platform-header').length,
        sidebars:document.querySelectorAll('.qiyan-platform-sidebar').length,
        main:document.querySelector('main')?.className,
        buttons:[...document.querySelectorAll('.ui-button')].map(el=>({text:el.textContent,type:el.getAttribute('type'),font:getComputedStyle(el).fontSize,line:getComputedStyle(el).lineHeight})),
      }));
      const failures=[];
      if(response.status()!==200)failures.push(`HTTP ${response.status()}`);
      if(dom.headers!==(portal?0:1)||dom.sidebars!==(portal?0:1))failures.push('Shell count mismatch');
      if(!portal&&!dom.main?.includes('platform-main'))failures.push('missing platform-main');
      if(dom.buttons.some(b=>!['button','submit','reset'].includes(b.type)||b.font!=='14px'))failures.push('shared Button type/font mismatch');
      // These exact React-key warnings are verified in untouched source files.
      // Keep them visible as debt; do not suppress other console/runtime errors.
      const knownComponents={p01:['Rail'],ai01:['MainAnswer','ContextRail'],e03:['Drawer']};
      const knownWarnings=errors.filter(message=>message.startsWith('Warning: Each child in a list should have a unique "key" prop.')&&knownComponents[entry.id]?.some(name=>message.includes(`render method of \`${name}\``)));
      failures.push(...errors.filter(message=>!knownWarnings.includes(message)));
      await page.screenshot({path:path.join(evidence,`${entry.id}-1440.png`)});
      rows.push({id:entry.id,route:entry.route,portal,...dom,errors,knownWarnings,failures,status:failures.length?'fail':knownWarnings.length?'pass-with-known-warning':'pass'});
    }catch(error){rows.push({id:entry.id,route:entry.route,status:'fail',failures:[error.message]});}
  }
  await writeFile(path.join(evidence,'results-with-classified-warnings.json'),JSON.stringify({viewport:{width:1440,height:900},scope:'50-page DOM/Button/Shell smoke, not full UX or backend acceptance; known React warnings remain unresolved',rows},null,2));
  console.log(JSON.stringify({pages:rows.length,sharedButtonConsumers:rows.filter(r=>r.buttons?.length).map(r=>r.id),failures:rows.filter(r=>r.status==='fail')},null,2));
  assert.equal(rows.filter(r=>r.status==='fail').length,0);
}finally{await context.close();await browser.close();}
