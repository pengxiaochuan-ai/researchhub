// Reproducible file://-only proof for cross-process Chrome tab/sessionStorage restore.
// No fixture, credentials, PG, localhost, runtime, or patient data is accessed.
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {workspace,evidenceDir,save} from './study-workflow-wf01-qa.mjs';
export async function proveOfflineProfile(){
 const {chromium}=createRequire('/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
 const temporaryRoot=workspace+'researchhub/.tmp/';mkdirSync(temporaryRoot,{recursive:true});
 const root=mkdtempSync(temporaryRoot+'wf01-offline-chrome-'),file=root+'/page.html';
 writeFileSync(file,'<title>WF01 offline session proof</title><p>Only non-private opaque test data.</p>');
 const url=pathToFileURL(file).href,options={headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--restore-last-session']};
 const blocked=[];let context;const proof={at:new Date().toISOString(),offlineOnly:true,syntheticOnly:true,noMarkerInjectionIntoProduct:true};
 async function blockNetwork(c){await c.route('**/*',route=>{if(['file:','about:','data:'].includes(new URL(route.request().url()).protocol))return route.continue();blocked.push(new URL(route.request().url()).protocol);return route.abort('blockedbyclient');});}
 try{
  context=await chromium.launchPersistentContext(root+'/profile',options);await blockNetwork(context);const original=await context.newPage();await original.goto(url);
  await original.evaluate(()=>sessionStorage.setItem('wf01-offline-nonprivate','opaque-offline-only'));await context.close();
  context=await chromium.launchPersistentContext(root+'/profile',options);await blockNetwork(context);const restored=context.pages().find(p=>p.url()===url);
  proof.restoredOriginalTab=Boolean(restored);assert(restored,'OFFLINE_ORIGINAL_TAB_NOT_RESTORED');
  proof.sessionStoragePreserved=await restored.evaluate(()=>sessionStorage.getItem('wf01-offline-nonprivate')==='opaque-offline-only');assert(proof.sessionStoragePreserved);
  const fresh=await context.newPage();await fresh.goto(url);proof.freshTabHasNoMarker=await fresh.evaluate(()=>sessionStorage.getItem('wf01-offline-nonprivate')===null);assert(proof.freshTabHasNoMarker);
  proof.protocols=[...new Set(context.pages().map(p=>new URL(p.url()).protocol))];assert(proof.protocols.every(p=>['file:','about:'].includes(p)));proof.blockedProtocols=blocked;assert.equal(blocked.length,0);
  proof.passed=true;save(evidenceDir+'offline/profile-restore-proof.json',proof);return proof;
 }finally{await context?.close().catch(()=>{});rmSync(root,{recursive:true,force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){assert.deepEqual(process.argv.slice(2),['--offline']);console.log(JSON.stringify(await proveOfflineProfile()));}
