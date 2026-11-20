import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import {resolve,isAbsolute} from 'node:path';
import {readFileSync} from 'node:fs';
import {verifyCoreBundle} from '../../deploy/core-bundle.mjs';

const developmentRoot=fileURLToPath(new URL('../../.private/core/',import.meta.url));
const cache=new Map();
export function coreDependencyRequire(){
 return runtimeDependencies({coreRoot:process.env.HUB_CORE_DIR,digest:process.env.HUB_CORE_MANIFEST_SHA256,requirePrivate:process.env.NODE_ENV==='production'||process.env.HUB_REQUIRE_PRIVATE_CORE==='true'}).require;
}
export function coreSourcePath(path){
 if(!/^[a-zA-Z0-9_./-]+$/.test(path)||path.split('/').some(x=>!x||x==='..'||x==='.'))throw Error('CORE_MODULE_PATH_REJECTED');
 return coreLocation({coreRoot:process.env.HUB_CORE_DIR,digest:process.env.HUB_CORE_MANIFEST_SHA256,requirePrivate:process.env.NODE_ENV==='production'||process.env.HUB_REQUIRE_PRIVATE_CORE==='true'})+'src/'+path+'.ts';
}
export function coreLocation({coreRoot,digest,requirePrivate=false}={}){
 if(!coreRoot){
  if(requirePrivate)throw new Error('CORE_PRIVATE_ROOT_REQUIRED');
  const pinned=JSON.parse(readFileSync(new URL('../../deploy/release-policy.json',import.meta.url),'utf8')).coreDigest;
  verifyCoreBundle(developmentRoot,pinned);return developmentRoot;
 }
 if(!isAbsolute(coreRoot))throw new Error('CORE_PRIVATE_ROOT_REQUIRED');
 const root=resolve(coreRoot);verifyCoreBundle(root,digest);return root+'/';
}
export function runtimeDependencies(options={}){
 const serverRoot=coreLocation(options);
 if(cache.has(serverRoot))return cache.get(serverRoot);
 const require=createRequire(serverRoot+'package.json');
  require('ts-node').register({project:serverRoot+'tsconfig.json',transpileOnly:true});
  require('reflect-metadata');
 const dependencies={require,load:(path,name)=>{
  if(!/^[a-zA-Z0-9_./-]+$/.test(path)||path.split('/').some(x=>!x||x==='..'||x==='.'))throw new Error('CORE_MODULE_PATH_REJECTED');
  return require(serverRoot+'src/'+path+'.ts')[name];
 }};
 cache.set(serverRoot,dependencies);return dependencies;
}
