import test from 'node:test';
import assert from 'node:assert/strict';
import {composeAssetCatalog,createLocalResearchAssetCatalog} from './local-research-assets-catalog.mjs';
import {mkdtempSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
test('one catalog source gate is shared by reading, editing and registration, with unknown families denied',async()=>{
 const hits=[],knowledge={assertSources:async(...a)=>{hits.push(['knowledge',...a]);return true;},sources:async()=>['actual-source']},uploads={assertSources:async(...a)=>{hits.push(['upload',...a]);return true;},list:()=>[]};
 const composed=composeAssetCatalog({ids:{owner:'owner',admin:'admin'},withAccess:async()=>{},knowledgeSources:knowledge,uploads});
 for(const family of ['knowledge','upload'])assert(await composed.assertSources('tx','actor',{sourceKind:family}));
 assert.deepEqual(hits.map(h=>h[0]),['knowledge','upload']);assert.equal(await composed.assertSources('tx','actor',{sourceKind:'artifact'}),false);
 assert.equal(await composed.assertSources('tx','actor',{sourceKind:'author',sourceBindings:[]}),true);assert.equal(await composed.assertSources('tx','actor',{sourceKind:'author',sourceBindings:[{}]}),false);
 assert.equal(typeof composed.reader.catalog,'function');assert.equal(typeof composed.registration.edit,'function');assert.equal(composed.uploads,uploads);
});
test('local assembly resolves existing old-system modules, without startup imports or fixture writes',()=>{
 const directory=mkdtempSync(join(tmpdir(),'rh-asset-compose-'));
 const fakeRequire=path=>{
  if(path.startsWith(root))assert(existsSync(path),'existing old module: '+path);
  if(path.endsWith('worker-publication.ts'))return{withAuthorizationMutation:()=>assert.fail('startup must not mutate')};
  if(path.endsWith('retrieval.service.ts'))return{withCurrentKnowledgeRead:()=>assert.fail('no startup read')};
  if(path.endsWith('knowledge-file-policy.ts'))return{assertKnowledgeImportFile:()=>{}};
  if(path==='@nestjs/platform-express')return{FileInterceptor:()=>class{}};
  return new Proxy({},{get:()=>()=>()=>{}});
 };
 try{const result=createLocalResearchAssetCatalog({root,dir:join(directory,'researchhub-knowledge-local'),ids:{tenant:'t',group:'g',project:'p',owner:'o',admin:'a'},require:fakeRequire});assert.equal(typeof result.registration.register,'function');assert.equal(typeof result.AssetRegistrationController,'function');}
 finally{rmSync(directory,{recursive:true,force:true});}
});
