export function guidanceCitationRequestAllowed(method,path){
 return method==='GET'?/^\/research-plan-drafts\/[A-Za-z0-9_-]+\/guidance-citations(?:\?versionNo=[1-9][0-9]{0,5})?$/.test(path):
  method==='POST'&&/^\/research-plan-drafts\/[A-Za-z0-9_-]+\/guidance-citations$/.test(path);
}
export function citationSelectionDirty(s){return Boolean(s.paragraph!==''||s.documentId||s.clauseId||s.confirmed||s.purpose!=='design_check');}
export function buildGuidanceCitationAdd(view,selection){
 const p=/^(0|[1-9][0-9]*)$/.test(selection.paragraph)?view?.paragraphs?.[Number(selection.paragraph)]:null;
 const s=view?.sources?.find(s=>s.documentId===selection.documentId),e=s?.clauseDetails;
 if(!view?.canEdit||view.readOnly||view.sourceStatus!=='current'||!p||!e||!e.clauses.some(c=>c.id===selection.clauseId)||!['design_check','background'].includes(selection.purpose)||selection.confirmed!==true)throw Error('请选择当前已保存段落与有效条款，核对原文和页码并明确确认。');
 return{action:'add',target:{start:p.start,end:p.end,sha256:p.sha256},source:{documentId:s.documentId,extractionId:e.extractionId,sourceSha256:e.sourceSha256,payloadSha256:e.payloadSha256},clauseId:selection.clauseId,purpose:selection.purpose,confirmed:true};
}
