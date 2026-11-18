const scopeId=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(v);
export const validInvitationId=v=>typeof v==='string'&&/^[A-Za-z0-9-]{8,100}$/.test(v);
const modules=new Set(['all','ethics','data','quality','access','centers','audit','system']);
const fail=()=>{throw Error('邀请链接无效，请从管理与治理或原Study重新进入。');};
export function invitationLocationHref(groupId,projectId,invitationId,overview){
 if(!scopeId(groupId)||!scopeId(projectId)||!validInvitationId(invitationId))fail();
 const p=new URLSearchParams({members:'1',studyGroupId:groupId,researchProjectId:projectId,invitationId});
 if(overview){if(!modules.has(overview.module)||!Number.isInteger(overview.page)||overview.page<1||overview.page>9999)fail();p.set('overviewModule',overview.module);p.set('overviewPage',String(overview.page));if(overview.attentionPage!==undefined){if(!Number.isInteger(overview.attentionPage)||overview.attentionPage<1||overview.attentionPage>9999)fail();p.set('overviewAttentionPage',String(overview.attentionPage));}}
 return'/pages/s11/?'+p;
}
export function readInvitationLocation(search=''){
 const p=new URLSearchParams(search);if(!p.has('invitationId'))return null;
 const allowed=['members','studyGroupId','researchProjectId','invitationId','overviewModule','overviewPage','overviewAttentionPage'];
 if([...p.keys()].some(k=>!allowed.includes(k)||p.getAll(k).length!==1)||p.get('members')!=='1'||!scopeId(p.get('studyGroupId'))||!scopeId(p.get('researchProjectId'))||!validInvitationId(p.get('invitationId')))fail();
 let overview;
 if(p.has('overviewModule')||p.has('overviewPage')||p.has('overviewAttentionPage')){if(!modules.has(p.get('overviewModule'))||!/^[1-9]\d{0,3}$/.test(p.get('overviewPage')??''))fail();overview={module:p.get('overviewModule'),page:Number(p.get('overviewPage'))};if(p.has('overviewAttentionPage')){if(!/^[1-9]\d{0,3}$/.test(p.get('overviewAttentionPage')??''))fail();overview.attentionPage=Number(p.get('overviewAttentionPage'));}}
 return{groupId:p.get('studyGroupId'),projectId:p.get('researchProjectId'),invitationId:p.get('invitationId'),...(overview?{overview}:{})};
}
