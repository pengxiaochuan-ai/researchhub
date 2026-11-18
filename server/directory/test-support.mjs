import {randomUUID} from 'node:crypto';
import {withRollback,runtime} from '../wp02/test-support.mjs';
export {runtime};
export async function directoryRollback(testBody){return withRollback(async({db,direct})=>{
 const [admin,owner]=await direct(tx=>tx.account.findMany({where:{id:{in:[runtime.ids.admin,runtime.ids.owner]}},select:{id:true,authVersion:true,isTenantAdmin:true}}));
 const accounts=[admin,owner],ctx=kind=>({user:{accountId:kind==='admin'?runtime.ids.admin:runtime.ids.owner,tenantId:runtime.ids.tenant,authVersion:accounts.find(a=>a.id===(kind==='admin'?runtime.ids.admin:runtime.ids.owner)).authVersion}});
 const suffix=randomUUID().slice(0,8),sourceId='rhd-source-test-'+suffix,rowId='rhd-row-test-'+suffix,batchId='rhd-batch-test-'+suffix,sha='d'.repeat(64),t=runtime.ids.tenant,h='lingshu-xinyu';
 await direct(async tx=>{
  await tx.$executeRaw`INSERT INTO rh_source.source_registry(id,tenant_id,hub_key,source_key,source_name,rights_status) VALUES(${sourceId},${t},${h},${sourceId},'本机合成目录测试材料','verified')`;
  await tx.$executeRaw`INSERT INTO rh_source.import_batch(id,tenant_id,hub_key,file_name,file_sha256,snapshot_path,sheet_name,mapper_version,scope_key,row_count,error_count,created_by) VALUES(${batchId},${t},${h},'synthetic-directory.txt',${sha},'synthetic://directory-test','事实清单','directory-test-v1',${batchId},1,0,${runtime.ids.admin})`;
  await tx.$executeRaw`INSERT INTO rh_source.source_record(id,tenant_id,hub_key,batch_id,source_registry_id,row_number,row_sha256,raw_fields,title,abstract_text) VALUES(${rowId},${t},${h},${batchId},${sourceId},2,${sha},'{}'::jsonb,'合成目录来源','仅本机测试：团队、机构、研究者及关系均为合成材料。')`;
  for(const field of ['bibliographic','abstract'])await tx.$executeRaw`INSERT INTO rh_source.review_decision(tenant_id,hub_key,source_registry_id,source_record_id,field_kind,purpose,audience,decision,evidence_ref,reviewer_id,confirmed_count) VALUES(${t},${h},${sourceId},${rowId},${field},'display','public','approve','evidence://directory-synthetic-test',${runtime.ids.admin},1)`;
 });
 const provenance=[{kind:'source_record',sourceId,rowId,versionId:null,sourceHash:sha,locator:'合成目录材料，第1节',fieldNames:['abstract']}];
 await testBody({db:{...db,hubKey:h},direct,ctx,provenance,rowId,sourceId,suffix});
});}
