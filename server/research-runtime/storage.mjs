const fail=()=>{throw Error('RESEARCH_STORAGE_CONFIGURATION_REQUIRED');};
export function storageSettings(env){
 let endpoint;try{endpoint=new URL(env.S3_ENDPOINT);}catch{fail();}
 if(!['http:','https:'].includes(endpoint.protocol)||endpoint.username||endpoint.password||endpoint.pathname!=='/'||endpoint.search||endpoint.hash||!env.S3_ACCESS_KEY||!env.S3_SECRET_KEY||!/^[-a-z0-9.]{3,63}$/.test(env.S3_BUCKET??''))fail();
 return Object.freeze({endpoint,bucket:env.S3_BUCKET,accessKey:env.S3_ACCESS_KEY,secretKey:env.S3_SECRET_KEY,region:env.S3_REGION});
}
// Reuse the storage I/O methods, but override its development bucket creation.
// Readiness is established by a read-only probe of an explicitly provisioned bucket.
export function createRuntimeStorage({load,require,settings}){
 const Base=load('storage/storage.service','StorageService'),{Client}=require('minio');
 class RuntimeStorage extends Base{
  initializing;
  onModuleInit(){
   if(this.ready)return Promise.resolve();
   if(!this.initializing)this.initializing=this.initializeStorage().finally(()=>{this.initializing=undefined;});
   return this.initializing;
  }
  async initializeStorage(){
   const url=settings.endpoint;
   this.bucket=settings.bucket;this.ready=false;
   this.client=new Client({endPoint:url.hostname,port:Number(url.port)||(url.protocol==='https:'?443:80),useSSL:url.protocol==='https:',accessKey:settings.accessKey,secretKey:settings.secretKey,region:settings.region,pathStyle:!url.hostname.endsWith('.aliyuncs.com')});
   if(!await this.probeAvailable(3000))throw Error('RESEARCH_STORAGE_NOT_READY');
  }
 }
 return new RuntimeStorage();
}
export async function createReadyRuntimeStorage(options){
 const storage=createRuntimeStorage(options);await storage.onModuleInit();return storage;
}
