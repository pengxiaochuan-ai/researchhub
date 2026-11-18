// One explicitly approved synthetic policy correction, never normal product limits.
import {catalogError} from '../../scripts/research-assets-catalog-contract.mjs';
import {assetDigest} from '../../scripts/research-assets-registration-contract.mjs';
export const REPAIR_ASSET_ID='rhab-ab736bd3-813e-4f3e-805f-b58a04d5190f';
const member='rh-c1-asset-member-20261117';
const fail=()=>{throw catalogError('FORBIDDEN',403,'当前操作超出本次已确认的资产范围。');};
export const isRepairRegistry=r=>r?.assetId===REPAIR_ASSET_ID&&r.ownerAccountId===member&&r.kind==='protocol';
function parent(p,r,ids){if(!isRepairRegistry(r)||!['tenantId','studyGroupId','researchProjectId'].every(k=>r[k]===p[k])||p.tenantId!==ids.tenant||p.studyGroupId!==ids.group||p.researchProjectId!==ids.project)fail();}
const exact=(v,expected)=>Array.isArray(v)&&v.length===expected.length&&new Set(v).size===v.length&&expected.every(x=>v.includes(x));
export async function assertRepairDraft(tx,p,command,ids){
 const r=command.registry;parent(p,r,ids);
 if(p.accountId!==member||command.id!==REPAIR_ASSET_ID||command.action!=='revise'||r.revision!==6||r.workingVersionNo!==2||command.next.workingVersionNo!==3||command.value.sourceKind!=='author'||command.value.sourceBindings.length||!exact(command.value.policy.discoveryRecipients,[member,ids.owner]))fail();
 const [v]=await tx.$queryRawUnsafe('SELECT metadata,rights_evidence,source_kind,content_hash FROM rh_asset.version_policy WHERE asset_id=$1 AND tenant_id=$2 AND study_group_id=$3 AND research_project_id=$4 AND version_no=2',r.assetId,p.tenantId,p.studyGroupId,p.researchProjectId);
 const original=await tx.researchArtifactVersion.findFirst({where:{artifactId:r.assetId,tenantId:p.tenantId,studyGroupId:p.studyGroupId,researchProjectId:p.researchProjectId,versionNo:2},select:{contentMd:true}});
 if(!v||!original||command.value.contentMd!==original.contentMd||assetDigest(original.contentMd)!==v.content_hash||assetDigest(command.value.metadata)!==assetDigest(v.metadata)||command.value.policy.rightsEvidence!==v.rights_evidence||v.source_kind!=='author')fail();
}
export function assertRepairEvent(p,{record,action,input},ids){
 const r=record.registry;parent(p,r,ids);
 const expected={7:['submit',member],8:['review',ids.admin],9:['release',ids.admin],10:['request',ids.owner],11:['decide',ids.admin],12:['cite',ids.owner],13:['withdraw',ids.admin]}[r.revision];
 if(record.family?.family!=='business'||r.workingVersionNo!==3||!expected||action!==expected[0]||p.accountId!==expected[1]||input?.version!==3||['review','release','decide','withdraw'].includes(action)&&p.isTenantAdmin!==true)fail();
 if(action==='release'&&!exact(input.discoveryRecipients,[ids.owner]))fail();
 if(action==='review'&&input.conclusion!=='approved')fail();
 if(['request','decide'].includes(action)&&(!exact(input.actions,['read_body','cite'])||action==='decide'&&input.conclusion!=='approved'))fail();
}
