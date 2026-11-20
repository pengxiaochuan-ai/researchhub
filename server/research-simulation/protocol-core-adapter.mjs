import {coreSourcePath} from '../research-runtime/dependencies.mjs';
import {Module,createRequire} from 'node:module';
import {createSimulationProtocolReferences} from './protocol-reference.mjs';

export function createSimulationProtocolAdapter({require,load,resolveCase}){
 const path=name=>coreSourcePath('study-operations/'+name);
 const servicePath=path('study-operations.service'),referencePath=path('protocol-fixed-references'),legacy=require(referencePath),policy=createSimulationProtocolReferences({legacy,resolveCase}),{BadRequestException}=require('@nestjs/common');
 policy.assertProtocolFixedReferences=async(tx,scope,protocol)=>{const result=await policy.checkProtocolFixedReferences(tx,scope,protocol);if(!result.ready)throw new BadRequestException({code:'PROTOCOL_FIXED_REFERENCES_INVALID',message:'方案引用的发布材料尚未就绪，请核对阻断项。',issues:result.issues});return result;};
 let instance;
 function adaptedLoad(source,name){
  if(source!=='study-operations/study-operations.service')return load(source,name);
  if(!instance){
   const compile=require.extensions?.['.ts'];if(typeof compile!=='function')throw Error('SIMULATION_TYPESCRIPT_UNAVAILABLE');
   const resolver=createRequire(servicePath),mod=new Module(servicePath);mod.filename=servicePath;
   mod.require=specifier=>resolver.resolve(specifier)===referencePath?policy:resolver(specifier);
   compile(mod,servicePath);mod.loaded=true;instance=mod;
  }
  return instance.exports[name];
 }
 return{load:adaptedLoad,policy};
}
