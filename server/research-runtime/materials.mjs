import {createSessionMaterialsController} from '../ai-agent/session-materials-controller.mjs';

// Nest resolves the native services after it has read controller metadata.
// Defer lookup, not the implementation: both launchers use the same controller.
export function deferredRuntimeService(resolve){
 return new Proxy({}, {get(_target,key){const service=resolve();const value=service[key];return typeof value==='function'?value.bind(service):value;}});
}
export function createRuntimeMaterials({foundation,config,load,require,getService}){
 const native=(path,name)=>deferredRuntimeService(()=>getService(path,name));
 return createSessionMaterialsController({
  env:foundation.transactionEnv,ids:foundation.ids,load,require,storage:foundation.storage,scope:config.scope,runtimePolicy:foundation.runtimePolicy,
  queue:native('knowledge/knowledge-import.service','KnowledgeImportService'),
  ingestion:native('knowledge/ingestion.service','IngestionService'),
  extract:native('knowledge/doc-extract.service','DocExtractService'),
  grounding:native('knowledge/grounding.service','GroundingService'),
 });
}
