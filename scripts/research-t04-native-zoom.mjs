import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync} from 'node:fs';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {workspaceRoot} from './research-creation-fixture.mjs';
assert.deepEqual(process.argv.slice(2),['--local-synthetic']);
const pointer=JSON.parse(readFileSync(workspaceRoot+'.tmp/researchhub-workflow/t04-current.json'));assert(pointer.acceptedFile.startsWith(workspaceRoot+'.tmp/researchhub-workflow/'));
const f=JSON.parse(readFileSync(pointer.acceptedFile));assert.equal(f.syntheticOnly,true);
const cookie=JSON.parse(readFileSync(workspaceRoot+'.tmp/researchhub-19501-integration/preflight-cookie.json')).owner;
const require=createRequire(import.meta.url),{chromium}=require(workspaceRoot+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright');
const out=workspaceRoot+'researchhub/docs/testing/evidence/research-t04-2026-11-11/native-zoom-'+randomUUID().slice(0,8)+'/';mkdirSync(out,{recursive:true});
const profile=mkdtempSync(workspaceRoot+'.tmp/t04-native-'),context=await chromium.launchPersistentContext(profile,{headless:true,viewport:null,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--window-size=1440,1000'],recordVideo:{dir:out+'video'}});
try{
 const settings=await context.newPage();await settings.goto('chrome://settings/appearance');await settings.locator('#zoomLevel').selectOption('2');
 for(const part of cookie.split(';')){const at=part.indexOf('=');if(at<1)continue;const name=part.slice(0,at).trim();if(['Path','Domain','Expires','SameSite','Max-Age'].includes(name))continue;await context.addCookies([{name,value:part.slice(at+1),domain:'127.0.0.1',path:'/api',httpOnly:true,sameSite:'Lax'}]);}
 const page=await context.newPage();await page.goto('http://127.0.0.1:19501/pages/s11/?'+new URLSearchParams({formalPreparation:'1',studyId:f.study.id,protocolId:f.protocolId}));await page.getByLabel('方案名称',{exact:true}).waitFor();
 const metrics=await page.evaluate(()=>({innerWidth,outerWidth,devicePixelRatio,scale:visualViewport.scale,scrollWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,font:getComputedStyle(document.querySelector('.ep-label')).fontSize,line:getComputedStyle(document.querySelector('.ep-label')).lineHeight}));
 assert.equal(metrics.devicePixelRatio,2);assert.equal(metrics.scale,1);assert.equal(metrics.innerWidth,Math.round(metrics.outerWidth/2));assert(metrics.scrollWidth<=metrics.innerWidth+1);assert.equal(metrics.font,'14px');assert.equal(metrics.line,'22px');
 const cdp=await context.newCDPSession(page);async function screenshot(name){const r=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:false,captureBeyondViewport:false});writeFileSync(out+name+'.png',Buffer.from(r.data,'base64'));}
 await page.getByLabel('方案名称',{exact:true}).scrollIntoViewIfNeeded();await screenshot('01-native-200-top');await page.getByRole('heading',{name:'4. 结局与采集映射',exact:true}).scrollIntoViewIfNeeded();await screenshot('02-native-200-bottom');
 const result={passed:true,at:new Date().toISOString(),method:'Chrome settings page zoom 200 percent; actual browser zoom, no CSS transform or device-only emulation',metrics,syntheticOnly:true};writeFileSync(out+'result.json',JSON.stringify(result,null,2));console.log(JSON.stringify({...result,evidence:out}));
}catch(error){writeFileSync(out+'failure.json',JSON.stringify({passed:false,message:error.message},null,2));console.error(JSON.stringify({passed:false,message:error.message,evidence:out}));process.exitCode=1;}finally{await context.close();}
