import {only,invalid,researchError,requestHash} from '../research-studies/contract.mjs';
import {cursorCodec,cursorBinding,pageLimit} from './capture-cursor.mjs';
import {correctionImpactRepository} from './correction-impact-repository.mjs';
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(v);
const scopeOf=c=>({tenantId:c.tenantId,studyGroupId:c.studyGroupId,researchProjectId:c.executionProjectId});
const sameRef=(a,b)=>a&&b&&['assignmentId','responseId','revisionNo','contentHash'].every(k=>a[k]===b[k]);
const changed=()=>{throw researchError(409,'CORRECTION_IMPACT_CHANGED','当前表单或来源已有变化，请重新核对更正影响。');};

/** Metadata only. Original visit/analysis/report commands still own every decision. */
export function createCorrectionImpactService({studies,core,repository=correctionImpactRepository,cursorSecret}){
 const cursors=cursorCodec(cursorSecret);
 return{read(user,studyId,assignmentId,query={}){
  if(!id(studyId)||!id(assignmentId))invalid();only(query,['kind','limit','cursor']);const kind=query.kind??'analysis';if(!['analysis','report'].includes(kind))invalid();const limit=pageLimit(query.limit);
  return studies.withResearchStudyTransaction(user,studyId,'read',async(tx,ctx)=>{
   const s=scopeOf(ctx),current=await core.authorize(tx,user,s.studyGroupId,s.researchProjectId,'read'),capture=await core.readAssignment(tx,user,s,assignmentId),a=capture.assignment,r=capture.response;
   if(s.tenantId!==user.tenantId||a?.id!==assignmentId||!id(a.subjectVisitId)||r?.status==='draft'||!r?.ref||!Number.isSafeInteger(r.version))changed();
   const visit=await core.readVisit(tx,user,s,a.subjectVisitId);if(visit.id!==a.subjectVisitId)changed();
   const admin=current.role==='tenant_admin'&&current.isTenantAdmin===true;
   const membership=admin?null:await tx.studyGroupMembership.findFirst({where:{tenantId:s.tenantId,studyGroupId:s.studyGroupId,accountId:user.accountId,status:'active',role:{tenantId:s.tenantId,status:'active'}},include:{role:true}}),role=membership?.role;
   const buttons=Array.isArray(role?.buttonPermissions)?role.buttonPermissions:[],menus=Array.isArray(role?.menuPermissions)?role.menuPermissions:[];
   const capabilities={canReadAnalysis:admin||buttons.includes('data.analyze'),canReadReports:admin||menus.includes('artifacts')&&buttons.includes('artifact.read')};
   const value={schemaVersion:'correction-impact-v1',studyId,assignmentId,ref:r.ref,responseVersion:r.version,locked:r.locked,review:r.review??null,visit:{visitId:visit.id,status:visit.status,completionIntegrity:visit.completionIntegrity,canReverify:visit.capabilities?.canReverify===true},capabilities,kind,restricted:!capabilities[kind==='analysis'?'canReadAnalysis':'canReadReports'],items:[],nextCursor:null};
   if(value.restricted)return value;
   const binding=cursorBinding(user,studyId,'correction-impact',{assignmentId,kind,source:requestHash({ref:r.ref,version:r.version})}),after=query.cursor===undefined?'':cursors.decode(query.cursor,binding,id);
   const rows=await repository.list(tx,s,{studyId,assignmentId,kind,limit:limit+1,after});
   value.items=rows.slice(0,limit).map(row=>{
    const sources=row.sources.filter(source=>source?.ref?.assignmentId===assignmentId);if(!sources.length)changed();
    const item={planId:row.planId,snapshotId:kind==='analysis'?row.id:row.snapshotId,branch:row.schemaVersion==='full-study-simulation-root-v2'?'full':'ordinary',createdAt:new Date(row.createdAt).toISOString(),sourceChanged:sources.some(source=>!sameRef(source.ref,r.ref)||source.responseVersion!==r.version)};
    return kind==='analysis'?{...item,runCount:Number(row.runCount)}:{...item,artifactId:row.id,title:row.title,status:row.status,versionNo:row.versionNo};
   });
   value.nextCursor=rows.length>limit?cursors.encode(binding,rows[limit-1].id):null;
   const latest=await core.readAssignment(tx,user,s,assignmentId);if(latest.response.version!==r.version||!sameRef(latest.response.ref,r.ref))changed();return value;
  });
 }};
}
