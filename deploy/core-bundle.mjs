import {readFileSync,writeFileSync,mkdirSync,readdirSync,lstatSync,existsSync,realpathSync} from 'node:fs';
import {resolve,relative,join,isAbsolute,dirname,basename,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const reject=code=>{throw new Error(code);};
const manifestName='core-manifest.json';
function destination(path){
 let parent=resolve(path);const tail=[];
 while(!existsSync(parent)){tail.unshift(basename(parent));parent=dirname(parent);}
 return join(realpathSync(parent),...tail);
}
function walk(root,sub,accept){
 if(lstatSync(join(root,sub)).isSymbolicLink())reject('CORE_SYMLINK_REJECTED');
 const result=[];
 for(const entry of readdirSync(join(root,sub),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
  const name=sub+'/'+entry.name;
  if(entry.isSymbolicLink())reject('CORE_SYMLINK_REJECTED');
  if(entry.isDirectory())result.push(...walk(root,name,accept));else if(accept(name))result.push(name);
 }
 return result;
}
function inventory(root){
 const files=['package.json','tsconfig.json',...walk(root,'src',()=>true),...walk(root,'prisma',()=>true)];
 if(existsSync(join(root,'vendor')))files.push(...walk(root,'vendor',()=>true));
 if(existsSync(join(root,'package-lock.json')))files.push('package-lock.json');
 return files.sort().map(path=>({path,sha256:sha(readFileSync(join(root,path)))}));
}
export function sealCoreBundle(output){
 const files=inventory(output),content=JSON.stringify({schemaVersion:1,kind:'researchhub-private-core',files},null,2)+'\n';
 writeFileSync(join(output,manifestName),content,{mode:0o600});
 return{files,digest:sha(content)};
}
export function buildCoreBundle({source,output}){
 source=realpathSync(resolve(source));output=destination(output);
 const rel=relative(source,output);
 if(!rel||(!(rel==='..'||rel.startsWith('..'+sep))&&!isAbsolute(rel))||existsSync(output))reject('CORE_OUTPUT_REJECTED');
 const original=JSON.parse(readFileSync(join(source,'package.json'),'utf8'));
 const dependencies={},vendored=[];
 for(const name of [...Object.keys(original.dependencies??{}),'ts-node','typescript','prisma']){
  if(!/^(?:@[a-z0-9-]+\/)?[a-z0-9._-]+$/i.test(name))reject('CORE_PACKAGE_REJECTED');
  const installed=JSON.parse(readFileSync(join(source,'node_modules',name,'package.json'),'utf8'));
  if(!/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i.test(installed.version))reject('CORE_VERSION_REJECTED');
  dependencies[name]=installed.version;
  if(/^https:\/\//.test(original.dependencies?.[name]??''))vendored.push({name,directory:realpathSync(join(source,'node_modules',name))});
 }
 const files=['tsconfig.json',...walk(source,'src',p=>/\.(?:ts|js|mjs|json)$/.test(p)&&!/(?:\.spec|\.test)\.[^.]+$/.test(p)),...walk(source,'prisma',p=>/\.(?:prisma|sql|toml)$/.test(p))];
 mkdirSync(output,{recursive:true,mode:0o700});
 if(vendored.length){
  const vendor=join(output,'vendor');mkdirSync(vendor);
  for(const item of vendored){
   const [packed]=JSON.parse(execFileSync('npm',['pack',item.directory,'--ignore-scripts','--json','--pack-destination',vendor],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000}));
   if(typeof packed?.filename!=='string'||packed.filename.includes('/')||!packed.filename.endsWith('.tgz'))reject('CORE_VENDOR_REJECTED');
   dependencies[item.name]='file:vendor/'+packed.filename;
  }
 }
 for(const file of files){const dest=join(output,file);mkdirSync(resolve(dest,'..'),{recursive:true});writeFileSync(dest,readFileSync(join(source,file)),{mode:0o600});}
 writeFileSync(join(output,'package.json'),JSON.stringify({name:'researchhub-private-core',version:'1.0.0',private:true,dependencies},null,2)+'\n',{mode:0o600});
 return sealCoreBundle(output);
}
export function verifyCoreBundle(root,expectedDigest){
 if(lstatSync(root).isSymbolicLink())reject('CORE_SYMLINK_REJECTED');
 if(!/^[a-f0-9]{64}$/.test(expectedDigest??''))reject('CORE_MANIFEST_MISMATCH');
 const bytes=readFileSync(join(root,manifestName));if(sha(bytes)!==expectedDigest)reject('CORE_MANIFEST_MISMATCH');
 const manifest=JSON.parse(bytes.toString());
 if(manifest.schemaVersion!==1||manifest.kind!=='researchhub-private-core'||!Array.isArray(manifest.files))reject('CORE_MANIFEST_REJECTED');
 for(const entry of manifest.files){
  if(typeof entry.path!=='string'||isAbsolute(entry.path)||entry.path.split('/').some(x=>!x||x==='..'||x==='.')||!/[a-f0-9]{64}/.test(entry.sha256??''))reject('CORE_MANIFEST_REJECTED');
  const p=join(root,entry.path);if(lstatSync(p).isSymbolicLink()||sha(readFileSync(p))!==entry.sha256)reject('CORE_CONTENT_MISMATCH');
 }
 const actual=inventory(root);
 if(actual.length!==manifest.files.length||actual.some(x=>!manifest.files.some(y=>x.path===y.path)))reject('CORE_UNLISTED_FILE');
 return manifest;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  const [command,source,output]=process.argv.slice(2);
  if(command==='build'&&source&&output)console.log(JSON.stringify(buildCoreBundle({source,output})));
  else if(command==='seal'&&source&&!output)console.log(JSON.stringify(sealCoreBundle(source)));
  else reject('CORE_ARGUMENTS_REJECTED');
 }catch(error){console.error(error?.message?.startsWith('CORE_')?error.message:'CORE_BUILD_FAILED');process.exitCode=1;}
}
