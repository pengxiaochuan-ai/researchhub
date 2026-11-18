import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {workspaceRoot,fixtureEnvironment} from './research-creation-fixture.mjs';
import {assertFixtureTarget} from '../../app/server/scripts/wp01/fixture-guard.mjs';

export async function verifyCreationNativeZoom({chromium,fixture:f,base,url,out}){
 const context=await chromium.launchPersistentContext(mkdtempSync(workspaceRoot+'.tmp/researchhub-creation-zoom-'),{headless:true,viewport:null,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--window-size=1440,1000'],recordVideo:{dir:out+'zoom-video',size:{width:1440,height:1000}}});
 try{
  const settings=context.pages()[0];await settings.goto('chrome://settings/appearance');await settings.locator('#zoomLevel').selectOption('2');
  const login=await context.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:f.ids.tenant,username:'admin@example.org',password:f.password}});assert.equal(login.status(),201);
  const page=await context.newPage();await page.goto(url);await page.locator('.rh-study-summary').waitFor();
  const metrics=await page.evaluate(()=>({outer:outerWidth,inner:innerWidth,dpr:devicePixelRatio,scale:visualViewport.scale,scroll:document.documentElement.scrollWidth}));writeFileSync(out+'native200.json',JSON.stringify(metrics,null,2));
  assert.equal(metrics.dpr,2);assert.equal(metrics.scale,1);assert(metrics.inner<metrics.outer/2+20&&metrics.scroll<=metrics.inner+1,JSON.stringify(metrics));
  const cdp=await context.newCDPSession(page),shot=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:false,captureBeyondViewport:false});writeFileSync(out+'native200.png',Buffer.from(shot.data,'base64'));await cdp.detach();return metrics;
 }finally{await context.close();}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 assert.equal(process.argv[2],'--fixture');const file=resolve(process.argv[3]);assert(file.startsWith(workspaceRoot+'.tmp/researchhub-creation/'));const f=JSON.parse(readFileSync(file));await assertFixtureTarget(fixtureEnvironment());
 const out=workspaceRoot+'researchhub/docs/testing/evidence/research-creation-2026-11-11/'+f.runId+'/native200-'+randomUUID().slice(0,8)+'/';mkdirSync(out,{recursive:true});
 const pw=await import(workspaceRoot+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),chromium=pw.chromium??pw.default.chromium;
 const accepted=JSON.parse(readFileSync(f.privateDirectory+'accepted.json')),base='http://127.0.0.1:19611';
 try{const metrics=await verifyCreationNativeZoom({chromium,fixture:f,base,url:base+'/pages/s01/?researchStudy=1&studyId='+accepted.project.study.id,out});writeFileSync(out+'result.json',JSON.stringify({passed:true,at:new Date().toISOString(),syntheticOnly:true,actualChrome:true,actualNativeZoom:true,zoom:2,metrics,modelCalls:0},null,2));console.log(JSON.stringify({passed:true,evidence:out,metrics}));}
 catch(error){writeFileSync(out+'failure.json',JSON.stringify({passed:false,message:error.message},null,2));console.error(JSON.stringify({passed:false,message:error.message,evidence:out}));process.exitCode=1;}
}
