import {directoryHash} from './contract.mjs';

export const isManualReference=ref=>ref.kind==='admin_verification';
export function claimDigest(fact){
 return directoryHash({entityId:fact.entityId,assertionKey:fact.assertionKey,kind:fact.kind,relatedEntityId:fact.relatedEntityId??null,payload:fact.payload,revision:fact.revision});
}
export function buildAdminVerification({tenantId,hubKey,teamId,draftVersion,actor,reason,audience,facts,id,verifiedAt}){
 const record={id,tenantId,hubKey,teamId,draftVersion,actorId:actor.id,actorDisplayName:actor.displayName,verifiedAt,reason,audience,claims:facts.map(f=>({entityId:f.entityId,assertionKey:f.assertionKey,kind:f.kind,relatedEntityId:f.relatedEntityId??null,payload:f.payload,revision:f.revision})),claimDigests:facts.map(claimDigest)};
 const reference={kind:'admin_verification',sourceId:teamId,versionId:id,rowId:null,sourceHash:directoryHash(record),locator:'管理员人工核实',fieldNames:[...new Set(facts.map(f=>'directory_'+f.kind))]};
 return {record,reference};
}
export async function readAdminVerification(tx,scope,reference){
 const [row]=await tx.$queryRaw`SELECT team_draft AS draft FROM rh_directory.entity WHERE tenant_id=${scope.tenantId} AND creation_hub_key=${scope.hubKey} AND id=${reference.sourceId} AND kind='team'`;
 const record=row?.draft?.verifications?.find(x=>x.id===reference.versionId),hash=record?directoryHash(record):null;
 const available=Boolean(record&&record.tenantId===scope.tenantId&&record.hubKey===scope.hubKey&&record.teamId===reference.sourceId&&record.id===reference.versionId&&hash===reference.sourceHash&&Array.isArray(record.claimDigests)&&['public',...(scope.audience==='tenant'?['tenant']:[])].includes(record.audience));
 return {record,available,fingerprint:directoryHash({reference,hash,available})};
}
export async function resolveAdminVerification(tx,scope,reference,fact){
 const result=await readAdminVerification(tx,scope,reference),digest=fact?claimDigest(fact):null;
 const available=Boolean(result.available&&fact&&['profile','affiliation','team_member'].includes(fact.kind)&&reference.fieldNames.includes('directory_'+fact.kind)&&result.record.claimDigests.includes(digest));
 const fingerprint=directoryHash({fingerprint:result.fingerprint,digest,available});
 if(!available)return {available:false,fingerprint};
 return {available:true,fingerprint,...reference,title:'管理员人工核实',sourceName:'管理员人工核实',sourceUrl:null,detailUrl:null,verifiedAt:result.record.verifiedAt,audience:result.record.audience};
}
