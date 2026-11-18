import {researchError} from '../server/research-studies/contract.mjs';
import {fullStudyHash,fail} from '../server/research-analysis/full-study-projection.mjs';
import {prepareFullStudyWorkbench} from './full-study-workbench-prepare.mjs';
import {createFullStudyMethodsBatch} from './full-study-methods-batch.mjs';
import {createFullStudyMethodsCapabilities} from './full-study-methods-capabilities.mjs';

// Trusted v2 composition only. Skip the public preliminary source projection;
// the native command/receipt still owns its full live check and transaction.
export function createFullStudyMethodsFacade(methods,{buildDescriptiveInput,descriptiveReference,canonicalManifestHash,exceptions,withBatchResolver}={}){
 const fresh=async(user,id,receipt=false)=>{
  const row=await methods.mustFindRun(user,id,false);
  if(row.skillKey!=='descriptive-statistics')throw researchError(404,receipt?'METHOD_RECEIPT_NOT_FOUND':'RUN_NOT_FOUND','未找到当前描述统计运行。');
  return row;
 };
 const overrides={
  ...(typeof withBatchResolver==='function'&&typeof methods.getDescriptiveCapabilities==='function'?createFullStudyMethodsCapabilities(methods):{}),
  ...(typeof withBatchResolver==='function'?createFullStudyMethodsBatch(methods,{withBatchResolver,descriptiveReference,canonicalManifestHash,exceptions}):{}),
  async authorizeJobOperatorInTransaction(tx,user,expected){
   if(typeof methods.authorizeDescriptiveJobOperatorInTransaction!=='function')throw researchError(503,'ANALYSIS_JOB_BRIDGE_UNAVAILABLE','当前后台分析方法权限暂不可核对。');
   return methods.authorizeDescriptiveJobOperatorInTransaction(tx,user,expected);
  },
  async createFromWorkbench(user,dto){
   if(dto.skillKey!=='descriptive-statistics')return methods.createFromWorkbench(user,dto);
   const prepared=await prepareFullStudyWorkbench(methods.descriptiveRuns(),user,dto,{descriptiveReference,canonicalManifestHash,exceptions});
   return methods.create(user,{skillKey:dto.skillKey,...prepared,idempotencyKey:dto.idempotencyKey,input:dto.input});
  },
  async authorizeReviewInTransaction(tx,user,row){
   const native=methods.descriptiveRuns(),current=await native.live(tx,user,row,'snapshot',false);
   await native.reviewRole(tx,current.auth.user,row.studyGroupId);
  },
  async verifyProcessRunInTransaction(tx,user,snapshot,current){
   if(typeof buildDescriptiveInput!=='function')throw researchError(503,'FULL_STUDY_PROCESS_AUTHORITY_UNAVAILABLE','当前计算结果暂不可核对。');
   const native=methods.descriptiveRuns(),{row}=await native.live(tx,user,snapshot,'snapshot',false);
   if(native.hash(buildDescriptiveInput(current),current.basis,row.skillVersion)!==row.inputHash||fullStudyHash(current.basis)!==fullStudyHash(row.dataSources?.analysisBasis??null))fail('METHOD_RUN_CHANGED');
   return row;
  },
  async review(user,id,body){
   const row=await fresh(user,id);
   return methods.present(await methods.descriptiveRuns().review(user,row,body),{idempotent:false});
  },
  async getDescriptiveReviewReceipt(user,id,key){
   const row=await fresh(user,id,true);
   return methods.descriptiveRuns().reviewReceipt(user,row,key);
  },
 };
 return new Proxy(methods,{get(target,key){
  if(Object.hasOwn(overrides,key))return overrides[key];
  const value=Reflect.get(target,key,target);
  return typeof value==='function'?value.bind(target):value;
 }});
}
