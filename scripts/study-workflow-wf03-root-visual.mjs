// Root-only zero-business-write checks of the new pending-review actions.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {openWF03Context,wf03Private,wf03Evidence,verifyWF03Freeze} from './study-workflow-wf03-root-context.mjs';
import {requireWF03Window} from './study-workflow-wf03-qa.mjs';
import {createWF03UiLedger,installWF03NativeGate} from './study-workflow-wf03-browser.mjs';
import {json,save} from './study-workflow-wf01-qa.mjs';
import {formalUrl} from '../src/formal-preparation-session.js';
requireWF03Window();const args=process.argv.slice(2);assert(['--local-synthetic','--local-synthetic --native200'].includes(args.join(' ')));const nativeOnly=args.includes('--native200');verifyWF03Freeze();
const out=wf03Evidence+'root/visual-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,5)+'/',origin='http://127.0.0.1:19501';
const {chromium}=createRequire('/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
let root;const measurements=[];
try{
 root=await openWF03Context();const me=await root.login('admin'),actor={accountId:me.accountId,authVersion:me.authVersion},c={...root.cases.B,code:'B'},tuple=json(wf03Private+'policy-tuples.json').B;
 for(const physical of nativeOnly?[true]:[false,true]){
  const context=await chromium.launchPersistentContext(wf03Private+'chrome-visual-'+(physical?'200':'normal'),{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,viewport:physical?null:{width:1440,height:1000},args:physical?['--window-size=1440,1000']:[],recordVideo:{dir:out+'video-'+(physical?'200':'normal'),size:{width:1440,height:1000}}});let gate,settings;
  try{
   const {loginBrowserContext}=await import('./visit-workflow-qa.mjs');const identity=root.accounts.admin;await loginBrowserContext(context,{tenantSlug:root.h.runtime.ids.tenant,username:identity.username,password:identity.password,expectedActorId:actor.accountId});
   gate=await installWF03NativeGate(context,{case:c,actor,expectedRevision:tuple.revision,policyTuple:{id:tuple.id,contentHash:tuple.contentHash},ledger:createWF03UiLedger()});
   const page=context.pages()[0]??await context.newPage();page.setDefaultTimeout(15000);await page.goto(origin+formalUrl('s11',c.studyId,c.protocolId));const card=page.locator('.ep-release > .ui-card').first(),primary=card.getByRole('button',{name:'批准并启用',exact:true});await primary.waitFor();
   if(physical){settings=await context.newPage();await settings.goto('chrome://settings/appearance');await settings.locator('#zoomLevel').selectOption('2');assert.equal(await settings.locator('#zoomLevel').inputValue(),'2');await page.bringToFront();}
   for(const [width,height]of physical?[[null,null]]:[[1440,1000],[1920,1200],[1366,768],[390,844],[320,844]]){
    if(!physical)await page.setViewportSize({width,height});await card.scrollIntoViewIfNeeded();await primary.focus();await page.keyboard.press('Space');const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'批准并启用',exact:true}).waitFor();
    for(let i=0;i<4;i++){await page.keyboard.press('Tab');assert.equal(await dialog.evaluate(n=>n.contains(document.activeElement)),true,'DIALOG_FOCUS_MUST_STAY_INSIDE');}
    const metric=await page.evaluate(()=>{const scope=[document.querySelector('.ep-release > .ui-card'),document.querySelector('dialog[open]')];return{innerWidth,innerHeight,devicePixelRatio,scale:visualViewport.scale,controls:scope.flatMap(s=>Array.from(s.querySelectorAll('button')).map(n=>{const style=getComputedStyle(n);return{text:n.textContent.trim(),fontSize:style.fontSize,lineHeight:style.lineHeight,rect:n.getBoundingClientRect().toJSON(),scrollWidth:n.scrollWidth,clientWidth:n.clientWidth};}))};});
    for(const control of metric.controls){assert.equal(control.fontSize,'14px');assert.equal(control.lineHeight,'22px');assert(control.rect.left>=-1&&control.rect.right<=metric.innerWidth+1,'NEW_ACTION_MUST_BE_VISIBLE_HORIZONTALLY');assert(control.scrollWidth<=control.clientWidth+1,'ACTION_TEXT_MUST_NOT_BE_CLIPPED');}
    const label=physical?'native200':'width-'+width;await page.screenshot({path:out+label+'-dialog.png'});metric.label=label;if(physical){const cdp=await context.newCDPSession(page);try{const shot=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false}),raw=Buffer.from(shot.data,'base64');metric.rawPngWidth=raw.readUInt32BE(16);metric.rawCapture='raw CDP no clip';writeFileSync(out+label+'-raw.png',raw);}finally{await cdp.detach();}assert.equal(metric.innerWidth,720);assert.equal(metric.devicePixelRatio,2);assert.equal(metric.scale,1);assert.equal(metric.rawPngWidth,1440);}measurements.push(metric);
    await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.equal(await primary.evaluate(n=>n===document.activeElement),true);await page.screenshot({path:out+label+'-actions.png'});
   }
   const dialogs=[],onDialog=async d=>{dialogs.push(d.type());await d.dismiss();};page.on('dialog',onDialog);try{await page.reload();await primary.waitFor();}finally{page.off('dialog',onDialog);}assert.deepEqual(dialogs,[],'CLEAN_GET_RELOAD_MUST_NOT_PROMPT');await gate.settle();assert.deepEqual(gate.report.requests,[]);assert.deepEqual(gate.report.blocked,[]);save(out+(physical?'native200':'normal')+'-zero-write.json',{readOnly:true,requests:0,blocked:0,pureGetDialogs:dialogs});
  }finally{if(settings){await settings.goto('chrome://settings/appearance').catch(()=>{});await settings.locator('#zoomLevel').selectOption('1').catch(()=>{});}if(gate)await gate.close();await context.request.post(origin+'/api/auth/logout',{headers:{Origin:origin,'X-ResearchHub-Request':'session-v1'},data:{}}).catch(()=>{});await context.close();}
 }
 save(out+'measurements.json',measurements);save(out+'protection.json',await root.protect('visual-zero-write'));save(out+'root-result.json',{passed:true,measurements:measurements.length,newControls:measurements.reduce((n,m)=>n+m.controls.length,0),unchangedShellCrowdingNotClaimedFixed:true});process.stdout.write(JSON.stringify({passed:true,evidence:out,measurements:measurements.length})+'\n');
}catch(error){save(out+'measurements.json',measurements);save(out+'root-result.json',{passed:false,error:{name:error.name,message:error.name==='AssertionError'?String(error.message).slice(0,240):undefined}});process.stderr.write(JSON.stringify({passed:false,evidence:out,errorName:error.name})+'\n');process.exitCode=1;}finally{if(root)await root.close();}
