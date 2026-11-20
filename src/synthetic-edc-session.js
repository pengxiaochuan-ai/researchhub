const valid=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(v);
const fail=()=>{throw Error('合成采集链接或研究范围无效，请从当前研究重新进入。');};
export const isSyntheticEdcRoute=(pageId,search)=>['s03','s04','s05'].includes(pageId)&&new URLSearchParams(search).has('syntheticCapture');
export function readSyntheticEdcLocation(pageId,search){
 const p=new URLSearchParams(search),allowed=['syntheticCapture','studyGroupId','researchProjectId','researchPlanId','collectionId','recordId'];
 if(!isSyntheticEdcRoute(pageId,search)||p.get('syntheticCapture')!=='1'||[...p.keys()].some(k=>!allowed.includes(k))||allowed.some(k=>p.getAll(k).length>1))fail();
 const scope={studyGroupId:p.get('studyGroupId'),researchProjectId:p.get('researchProjectId')},planId=p.get('researchPlanId'),collectionId=p.get('collectionId'),recordId=p.get('recordId');
 if(!valid(scope.studyGroupId)||!valid(scope.researchProjectId)||!valid(planId)||(collectionId&&!valid(collectionId))||(recordId&&!valid(recordId))||(pageId!=='s03'&&!collectionId)||(recordId&&!collectionId))fail();
 return{scope,planId,collectionId,recordId};
}
export function makeSyntheticEdcUrl(pageId,scope,planId,collectionId,recordId){
 const p=new URLSearchParams({syntheticCapture:'1',studyGroupId:scope?.studyGroupId??'',researchProjectId:scope?.researchProjectId??'',researchPlanId:planId??''});
 if(collectionId)p.set('collectionId',collectionId);if(recordId)p.set('recordId',recordId);readSyntheticEdcLocation(pageId,p.toString());return'/pages/'+pageId+'/?'+p;
}
export function syntheticEdcHeader(config,pageId,search){return isSyntheticEdcRoute(pageId,search)?{...config,title:pageId==='s03'?'合成采集演练':pageId==='s04'?'合成CRF记录':'合成记录质控',description:'本人私有演练记录与确定性质控，不是正式EDC、临床结论或研究放行。',meta:"合成数据演练 · 私有本人记录",actions:[],nav:undefined,crumbs:[['科研资产','a01'],['知识资料','k01'],['合成采集演练']]}:config;}
