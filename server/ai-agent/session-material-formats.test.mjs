import test from 'node:test';import assert from 'node:assert/strict';
import {createRequire} from 'node:module';import {readFileSync,statSync} from 'node:fs';
import {createMaterialFixtures} from '../../scripts/ai-material-fixtures.mjs';
const require=createRequire(new URL('../../../app/server/package.json',import.meta.url));
require('ts-node').register({project:new URL('../../../app/server/tsconfig.json',import.meta.url).pathname,transpileOnly:true});
process.env.KB_DOC_PARSER_URL='http://127.0.0.1:19503';
const nativeFetch=globalThis.fetch;
globalThis.fetch=(url,init)=>{assert.equal(String(url),'http://127.0.0.1:19503/extract');assert.equal(init.method,'POST');return nativeFetch(url,{...init,redirect:'error'});};
const {DocExtractService}=require(new URL('../../../app/server/src/knowledge/doc-extract.service.ts',import.meta.url).pathname);
const {inspectKnowledgeImportFile}=require(new URL('../../../app/server/src/knowledge/knowledge-file-policy.ts',import.meta.url).pathname);
test('four synthetic document formats pass the original full-file inspection and real local parser',async t=>{
 const fixture=await createMaterialFixtures(),extract=new DocExtractService();
 for(const [extension,path] of Object.entries(fixture.paths))await t.test(extension,async()=>{
  const inspected=await inspectKnowledgeImportFile({path,filename:'original-private-name.'+extension,size:statSync(path).size});
  assert.equal(inspected.extension,extension);assert.match(inspected.storageFilename,/^knowledge_[a-f0-9]{16}\./);
  const parsed=await extract.extract('synthetic.'+extension,readFileSync(path));
  for(const marker of ['P02-HEAD','P02-MIDDLE','P02-TAIL'])assert(parsed.contentMd.includes(marker),extension+': missing '+marker);
  assert(parsed.contentMd.includes('zero and false'));
 });
});
