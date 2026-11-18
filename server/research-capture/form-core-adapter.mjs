import {Module,createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createResearchFormPolicy} from './form-policy.mjs';

const sourcePath=name=>fileURLToPath(new URL('../../../app/server/src/study-operations/'+name+'.ts',import.meta.url));
const privateModules=new Set(['formal-response-writer','formal-response-commands','study-outreach.service'].map(sourcePath));
const policyPath=sourcePath('study-forms-policy');

/**
 * Reuse the existing authorized transaction core with ResearchHub's policy.
 * Only these three trusted source modules receive private CommonJS instances.
 * No global cache/export replacement, source edits or extra controllers.
 * `policy` is trusted in-process composition, never an HTTP input.
 */
export function createResearchFormAdapter({require,load,policy}){
 const legacy=require(policyPath),researchPolicy=policy??createResearchFormPolicy(legacy),cache=new Map();
 const compile=require.extensions?.['.ts'];
 if(typeof compile!=='function')throw new Error('FORM_ADAPTER_TYPESCRIPT_UNAVAILABLE');
 function privateModule(filename){
  if(cache.has(filename))return cache.get(filename).exports;
  const resolver=createRequire(filename),instance=new Module(filename);
  instance.filename=filename;
  instance.require=specifier=>{
   const target=resolver.resolve(specifier);
   if(target===policyPath)return researchPolicy;
   if(privateModules.has(target))return privateModule(target);
   return resolver(specifier);
  };
  cache.set(filename,instance);
  try{compile(instance,filename);instance.loaded=true;return instance.exports;}
  catch(error){cache.delete(filename);throw error;}
 }
 function researchLoad(path,name){
  if(path==='study-operations/study-forms-policy')return researchPolicy[name];
  const filename=path.startsWith('study-operations/')?sourcePath(path.slice('study-operations/'.length)):null;
  return filename&&privateModules.has(filename)?privateModule(filename)[name]:load(path,name);
 }
 return {policy:researchPolicy,load:researchLoad};
}
