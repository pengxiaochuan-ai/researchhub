// Explicit opt-in, read-only synthetic PG checks. Never initializes or persists a fixture.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadFixtureInput} from '../../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import {sealResearchAssetVersion,presentResearchAssetVersion} from '../../scripts/research-assets-read-contract.mjs';
const {env}=loadFixtureInput(process.argv[2]);
const {ids}=JSON.parse(readFileSync(process.argv[3],'utf8'));
assert.ok(['tenant','group','project','owner','admin'].every(k=>typeof ids[k]==='string'&&ids[k].startsWith('rh-kb-local-')));
await assertFixtureTarget(env);
const result=await withFixtureTransaction(env,'app',async tx=>{
 for(const [key,value]of [['app.tenant_id',ids.tenant],['app.study_group_id',ids.group],['app.research_project_id',ids.project]])await tx.$queryRawUnsafe('SELECT set_config($1,$2,true)',key,value);
 const mode=await tx.$queryRawUnsafe('SHOW transaction_read_only');assert.equal(mode[0].transaction_read_only,'on');
 const counts=[];
 for(const accountId of [ids.owner,ids.admin]){
  const base={tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,ownerAccountId:accountId,status:'draft',deletedAt:null,id:{not:{startsWith:'rh-formal-report-'}}};
  const exclusion={idempotencyKey:{not:{startsWith:'rh-research-asset:'}}};
  const original=await tx.researchArtifact.count({where:base});
  const filtered=await tx.researchArtifact.count({where:{...base,AND:[exclusion]}});
  const newFamily=await tx.researchArtifact.count({where:{...base,idempotencyKey:{startsWith:'rh-research-asset:'}}});
  assert.equal(filtered,original-newFamily);
  const emptyKey=await tx.researchArtifact.count({where:{...base,idempotencyKey:''}});
  assert.equal(await tx.researchArtifact.count({where:{...base,idempotencyKey:'',AND:[exclusion]}}),emptyKey);
  counts.push({actor:accountId===ids.owner?'owner':'admin',original,filtered,newFamily,emptyKey});
 }
 const user={tenantId:ids.tenant,studyGroupId:ids.group,researchProjectId:ids.project,accountId:ids.owner};
 for(const assetKind of ['protocol','dataset','instrument','analysis','publication']){
  const contentMd='只读事务中的合成材料，不写数据库。',registrationKey='rh-research-asset:jsonb-probe:'+assetKind;
  const block=sealResearchAssetVersion({...user,ownerAccountId:user.accountId,assetKind,registrationKey,versionNo:1,metadata:{title:'合成'+assetKind,summary:'人工摘要',purpose:'只读校验',limitations:'不含科研结果',author:'合成作者'},source:{kind:'author_declared_synthetic',label:'人工合成说明'},contentMd});
  const [row]=await tx.$queryRawUnsafe('SELECT $1::jsonb AS block',JSON.stringify(block));
  const artifact={...user,id:'jsonb_probe',ownerAccountId:user.accountId,createdBy:user.accountId,typeKey:'research_report',status:'draft',deletedAt:null,currentVersionNo:1,idempotencyKey:registrationKey};
  const version={...user,artifactId:artifact.id,versionNo:1,contentMd,contentBlocks:[row.block],createdBy:user.accountId};
  assert.equal(presentResearchAssetVersion({artifact,version,user}).kind,assetKind);
 }
 const [sql]=await tx.$queryRawUnsafe("WITH sample(key) AS (VALUES (''::text),('old-key'),('rh-research-asset:new')) SELECT count(*)::int AS kept FROM sample WHERE key NOT LIKE 'rh-research-asset:%'");assert.equal(sql.kept,2);
 return{transactionReadOnly:true,counts,jsonbKindsPassed:5,emptyKeySemanticsPassed:true,businessWrites:0};
},{readOnly:true});
console.log(JSON.stringify(result,null,2));
