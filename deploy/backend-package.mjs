import {readFileSync,writeFileSync,mkdirSync,readdirSync,existsSync,rmSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {verifyCoreBundle,sealCoreBundle} from './core-bundle.mjs';
import {createHash} from 'node:crypto';
import {applyKnowledgeAdminAdaptation} from './knowledge-admin-adaptation.mjs';

const repository=fileURLToPath(new URL('../',import.meta.url));
function save(path,bytes){mkdirSync(dirname(path),{recursive:true});writeFileSync(path,bytes,{mode:0o600});}
function codeInventory(root,sub=''){
 const files=[];
 for(const entry of readdirSync(join(root,sub),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
  if(entry.name==='node_modules')continue;
  const path=sub?sub+'/'+entry.name:entry.name;
  if(entry.isSymbolicLink())throw Error('BACKEND_CODE_SYMLINK_REJECTED');
  if(entry.isDirectory())files.push(...codeInventory(root,path));else files.push({path,sha256:createHash('sha256').update(readFileSync(join(root,path))).digest('hex')});
 }
 return files;
}
export function verifyBackendPackage(root){
 const release=JSON.parse(readFileSync(join(root,'release.json')));verifyCoreBundle(join(root,'core'),release.coreDigest);
 const files=codeInventory(join(root,'hub'));
 if(JSON.stringify(files)!==JSON.stringify(release.hubFiles)||createHash('sha256').update(JSON.stringify(files)).digest('hex')!==release.hubDigest)throw Error('BACKEND_CONTENT_MISMATCH');return release;
}
export function nativePrismaSchema(source){
 const blocks=[...source.matchAll(/generator\s+client\s*\{[^}]*\}/g)];
 if(blocks.length!==1)throw Error('BACKEND_PRISMA_GENERATOR_REJECTED');
 const original=blocks[0][0],targets=original.match(/\bbinaryTargets\s*=\s*\[[^\]]*\]/g);
 if(targets?.length!==1)throw Error('BACKEND_PRISMA_GENERATOR_REJECTED');
 return source.replace(original,original.replace(targets[0],'binaryTargets = ["native"]'));
}
function copyCode(source,target){
 for(const entry of readdirSync(source,{withFileTypes:true})){
  if(['node_modules','.tmp','.git','evidence','fixtures','__pycache__'].includes(entry.name))continue;
  const path=join(source,entry.name),destination=join(target,entry.name);
  if(entry.isSymbolicLink())throw new Error('BACKEND_CODE_SYMLINK_REJECTED');
  if(entry.isDirectory())copyCode(path,destination);
  else if(/\.(?:mjs|js|ts|json|sql|yaml|yml|md|xml|csv|txt)$/.test(entry.name)&&!/(?:\.test|\.spec)\.[^.]+$/.test(entry.name))save(destination,readFileSync(path));
 }
}

// Refresh only Hub code. The sealed, already-adapted private core is immutable.
export function refreshBackendHub({context,source=repository,sourceGit}){
 context=resolve(context);source=resolve(source);
 if(!/^[a-f0-9]{40}$/.test(sourceGit??'')||context===source||source.startsWith(context+'/'))throw Error('BACKEND_REFRESH_SCOPE_REJECTED');
 const previous=verifyBackendPackage(context),resources=['pages/h01/src/china.json','docs/reference/china-administrative-divisions/mca-2024.html','docs/reference/city-map-2026-11-10/manifest.json',...['Q74881-2548806680','Q956-2565775546','Q8686-2554225580'].map(id=>'docs/reference/city-map-2026-11-10/wikidata/'+id+'.json')];
 const bytes=resources.map(path=>({path,bytes:readFileSync(join(existsSync(join(source,path))?source:join(context,'hub'),path))}));
 rmSync(join(context,'hub'),{recursive:true});
 for(const dir of ['server','src','scripts','integrations','skill','deploy'])copyCode(join(source,dir),join(context,'hub',dir));
 for(const file of bytes)save(join(context,'hub',file.path),file.bytes);
 save(join(context,'hub/package.json'),JSON.stringify({name:'researchhub-backend',private:true,type:'module',version:'1.0.0'})+'\n');
 save(join(context,'Dockerfile'),readFileSync(join(source,'deploy/backend.Dockerfile')));
 const hubFiles=codeInventory(join(context,'hub')),release={...previous,sourceGit,hubFiles,hubDigest:createHash('sha256').update(JSON.stringify(hubFiles)).digest('hex'),createdAt:new Date().toISOString(),productionMigrationPerformed:false};
 save(join(context,'release.json'),JSON.stringify(release,null,2)+'\n');verifyBackendPackage(context);return release;
}

export function prepareBackendPackage({core,expectedDigest,output}){
 core=resolve(core);output=resolve(output);
 if(existsSync(output)||output===repository||output.startsWith(core+'/'))throw new Error('BACKEND_OUTPUT_REJECTED');
 const verified=verifyCoreBundle(core,expectedDigest);mkdirSync(output,{recursive:true,mode:0o700});
 for(const item of verified.files)save(join(output,'core',item.path),readFileSync(join(core,item.path)));
 const knowledgeAdaptation=applyKnowledgeAdminAdaptation({source:core,output:join(output,'core')});
 const schemaFile=join(output,'core/prisma/schema.prisma'),schema=readFileSync(schemaFile,'utf8');
 save(schemaFile,nativePrismaSchema(schema));
 save(join(output,'core/prisma/runtime-generator.json'),JSON.stringify({sourceSchemaSha256:createHash('sha256').update(schema).digest('hex'),binaryTargets:['native'],reason:'Generate the Prisma engine for the actual Linux build platform; database models and migrations are unchanged.'},null,2)+'\n');
 const packageFile=join(output,'core/package.json'),pkg=JSON.parse(readFileSync(packageFile));
 // Nodemailer is a Hub dependency, already pinned in its own package.json.
 pkg.dependencies.nodemailer=JSON.parse(readFileSync(join(repository,'package.json'))).dependencies.nodemailer;
 save(packageFile,JSON.stringify(pkg,null,2)+'\n');mkdirSync(join(output,'core/vendor'),{recursive:true});
 const npmrc=join(output,'build.npmrc');save(npmrc,'registry=https://registry.npmjs.org\nignore-scripts=true\naudit=false\nfund=false\nfetch-timeout=15000\nfetch-retries=1\n');
 execFileSync('npm',['install','--package-lock-only','--ignore-scripts','--no-audit','--no-fund','--userconfig='+npmrc],{cwd:join(output,'core'),stdio:['ignore','pipe','pipe'],timeout:180000});
 const result=sealCoreBundle(join(output,'core'));
 for(const dir of ['server','src','scripts','integrations','skill','deploy'])copyCode(join(repository,dir),join(output,'hub',dir));
 const resources=['pages/h01/src/china.json','docs/reference/china-administrative-divisions/mca-2024.html','docs/reference/city-map-2026-11-10/manifest.json',...['Q74881-2548806680','Q956-2565775546','Q8686-2554225580'].map(id=>'docs/reference/city-map-2026-11-10/wikidata/'+id+'.json')];
 for(const path of resources)save(join(output,'hub',path),readFileSync(join(repository,path)));
 save(join(output,'hub/package.json'),JSON.stringify({name:'researchhub-backend',private:true,type:'module',version:'1.0.0'})+'\n');
 save(join(output,'Dockerfile'),readFileSync(new URL('./backend.Dockerfile',import.meta.url)));
 save(join(output,'.dockerignore'),'build.npmrc\n*.env\n.env*\n**/node_modules\n');
 const hubFiles=codeInventory(join(output,'hub'));
 const release={schemaVersion:1,kind:'researchhub-private-backend',sourceCoreDigest:expectedDigest,coreDigest:result.digest,adaptations:[knowledgeAdaptation.kind],hubFiles,hubDigest:createHash('sha256').update(JSON.stringify(hubFiles)).digest('hex'),createdAt:new Date().toISOString(),productionMigrationPerformed:false};
 save(join(output,'release.json'),JSON.stringify(release,null,2)+'\n');return release;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{const[core,expectedDigest,output]=process.argv.slice(2);if(!core||!expectedDigest||!output)throw new Error('BACKEND_ARGUMENTS_REJECTED');const r=prepareBackendPackage({core,expectedDigest,output});console.log(JSON.stringify({kind:r.kind,coreDigest:r.coreDigest,hubDigest:r.hubDigest,files:r.hubFiles.length}));}
 catch(error){console.error(error.message?.startsWith('BACKEND_')||error.message?.startsWith('CORE_')?error.message:'BACKEND_PACKAGE_FAILED');process.exitCode=1;}
}
