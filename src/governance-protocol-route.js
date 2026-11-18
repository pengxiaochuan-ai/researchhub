const tabs=new Set(['pending','processed']);
const valid=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const fail=()=>{throw Error('方案审核链接无效，请从管理与治理重新进入。');};
export function readProtocolReviewRoute(search=''){
 const p=new URLSearchParams(search);
 if([...p.keys()].some(k=>k!=='reviewTab'||p.getAll(k).length!==1)||p.has('reviewTab')&&!tabs.has(p.get('reviewTab')))fail();
 return{tab:p.get('reviewTab')??'pending'};
}
export function protocolReviewHref(tab='pending'){if(!tabs.has(tab))fail();return '/pages/g01/?'+new URLSearchParams({reviewTab:tab});}
export function protocolReviewDetailHref(studyId,protocolId,tab='pending'){
 if(!valid(studyId)||!valid(protocolId)||!tabs.has(tab))fail();
 return '/pages/s07/?'+new URLSearchParams({formalPreparation:'1',studyId,protocolId,reviewTab:tab});
}
