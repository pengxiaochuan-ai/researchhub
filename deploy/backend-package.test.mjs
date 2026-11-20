import test from'node:test';import assert from'node:assert/strict';import{nativePrismaSchema}from'./backend-package.mjs';
test('Linux package adapts only the private generator target, preserving database model semantics',()=>{
 const source='generator client {\n provider = "prisma-client-js"\n binaryTargets = ["windows","darwin-arm64"]\n}\ndatasource db { provider = "postgresql" }\nmodel Synthetic { id String @id }';
 const result=nativePrismaSchema(source);assert(result.includes('binaryTargets = ["native"]'));assert.equal(result.replace('binaryTargets = ["native"]','binaryTargets = ["windows","darwin-arm64"]'),source);
 assert.throws(()=>nativePrismaSchema('model Synthetic {id String @id}'),/BACKEND_PRISMA_GENERATOR_REJECTED/);
 assert.throws(()=>nativePrismaSchema(source+source),/BACKEND_PRISMA_GENERATOR_REJECTED/);
});
import{mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync}from'node:fs';import{join}from'node:path';import{tmpdir}from'node:os';import{createHash}from'node:crypto';import{sealCoreBundle}from'./core-bundle.mjs';
import{refreshBackendHub}from'./backend-package.mjs';
test('fresh Git Hub replaces old package code while the approved core remains byte-identical',()=>{
 const root=mkdtempSync(join(tmpdir(),'hub-refresh-'));const context=join(root,'context'),source=join(root,'source');const save=(p,t)=>{mkdirSync(join(p,'..'),{recursive:true});writeFileSync(p,t);};
 try{
  for(const p of ['package.json','tsconfig.json','src/core.ts','prisma/schema.prisma'])save(join(context,'core',p),p==='package.json'?'{"dependencies":{"nodemailer":"1.0.0"}}':'sealed');
  const core=sealCoreBundle(join(context,'core'));save(join(context,'hub/server/old.mjs'),'old stale source');
  const hubFiles=[{path:'server/old.mjs',sha256:createHash('sha256').update('old stale source').digest('hex')}];
  save(join(context,'release.json'),JSON.stringify({schemaVersion:1,kind:'researchhub-private-backend',coreDigest:core.digest,hubFiles,hubDigest:createHash('sha256').update(JSON.stringify(hubFiles)).digest('hex')}));
  for(const dir of ['server','src','scripts','integrations','skill','deploy'])mkdirSync(join(source,dir),{recursive:true});
  save(join(source,'deploy/backend-runtime-exclusions.json'),JSON.stringify({schema:'hub-manual-tools-not-runtime.v1',paths:['scripts/manual-setup.mjs','server/manual-only.sql']}));save(join(source,'scripts/manual-setup.mjs'),'CREATE TABLE manual_only(id text)');save(join(source,'server/manual-only.sql'),'CREATE TABLE manual_only(id text)');
  save(join(source,'package.json'),'{"dependencies":{"nodemailer":"1.0.0"}}');save(join(source,'server/new.mjs'),'new current Git code');save(join(source,'deploy/backend.Dockerfile'),'FROM fixture');
  const resources=['pages/h01/src/china.json','docs/reference/china-administrative-divisions/mca-2024.html','docs/reference/city-map-2026-11-10/manifest.json',...['Q74881-2548806680','Q956-2565775546','Q8686-2554225580'].map(id=>'docs/reference/city-map-2026-11-10/wikidata/'+id+'.json')];
  for(const p of resources)save(join(source,p),'approved geographic resource');
  const knowledgeFiles=['parser.py','embedding.py','run.py','verify_model.py','parser.Dockerfile','embedding.Dockerfile','dependencies.json','model.json','source-manifest.json'];for(const name of knowledgeFiles)save(join(source,'services/knowledge',name),'owned '+name);save(join(source,'services/knowledge/secret.env'),'excluded');save(join(source,'services/elsewhere.py'),'excluded');
  const result=refreshBackendHub({context,source,sourceGit:'a'.repeat(40)});
  for(const p of ['scripts/manual-setup.mjs','server/manual-only.sql']){assert(existsSync(join(source,p)));assert(!existsSync(join(context,'hub',p)));assert(!result.hubFiles.some(x=>x.path===p));}
  assert.equal(result.coreDigest,core.digest);assert.equal(result.sourceGit,'a'.repeat(40));assert.equal(readFileSync(join(context,'hub/server/new.mjs'),'utf8'),'new current Git code');assert.equal(existsSync(join(context,'hub/server/old.mjs')),false);assert.notEqual(result.hubDigest,createHash('sha256').update(JSON.stringify(hubFiles)).digest('hex'));
  for(const name of knowledgeFiles){assert.equal(readFileSync(join(context,'hub/services/knowledge',name),'utf8'),'owned '+name);assert(result.hubFiles.some(x=>x.path==='services/knowledge/'+name));}assert.equal(existsSync(join(context,'hub/services/knowledge/secret.env')),false);assert.equal(existsSync(join(context,'hub/services/elsewhere.py')),false);
  rmSync(join(source,resources[1]));const again=refreshBackendHub({context,source,sourceGit:'b'.repeat(40)});assert.equal(again.coreDigest,core.digest);assert.equal(readFileSync(join(context,'hub',resources[1]),'utf8'),'approved geographic resource');
  save(join(source,'package.json'),'{"dependencies":{"nodemailer":"2.0.0"}}');assert.throws(()=>refreshBackendHub({context,source,sourceGit:'c'.repeat(40)}),/BACKEND_CORE_DEPENDENCY_REAPPROVAL_REQUIRED/);save(join(source,'package.json'),'{"dependencies":{"nodemailer":"1.0.0"}}');
  writeFileSync(join(context,'core/src/core.ts'),'tampered');assert.throws(()=>refreshBackendHub({context,source,sourceGit:'c'.repeat(40)}),/CORE_CONTENT_MISMATCH/);
 }finally{rmSync(root,{recursive:true,force:true});}
});

import{assertRuntimeEntrypoint}from'./backend-package.mjs';
test('runtime packaging cannot exclude a dependency reached by the official entry',()=>{
 const root=mkdtempSync(join(tmpdir(),'hub-runtime-import-'));try{mkdirSync(join(root,'server/research-runtime'),{recursive:true});writeFileSync(join(root,'server/research-runtime/start.mjs'),"import './required.mjs';");assert.throws(()=>assertRuntimeEntrypoint(root),/BACKEND_RUNTIME_DEPENDENCY_MISSING/);writeFileSync(join(root,'server/research-runtime/required.mjs'),'export const ready=true;');assert.equal(assertRuntimeEntrypoint(root),2);}finally{rmSync(root,{recursive:true,force:true});}
});
