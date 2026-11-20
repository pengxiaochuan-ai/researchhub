export function knowledgePublicError(error){
 if(typeof error?.getResponse==='function')return error;
 const code=error?.code??error?.message??'',known=/^(?:QA_[A-Z_]+|KNOWLEDGE_[A-Z_]+|WORKER_[A-Z_]+|HUB_CHAT_[A-Z_]+|HUB_ANSWER_NOT_DELIVERABLE(?::[A-Z_+]+)?)$/.test(code);
 const message=code==='QA_NO_EVIDENCE'?'当前库没有匹配的已审核资料，未生成回答。请核对审核状态或换用资料中的具体关键词。':
  /SOURCE|AUTHORIZATION|PURPOSE|SCOPE|WORKER_/.test(code)?'资料、权限或任务状态已变化，未交付回答。请刷新会话后核对。':
  /BUDGET|QUOTA|DISPATCH/.test(code)?'当前AI可用额度不足，未交付回答。请联系管理员核对。':
  /CITATION|NOT_DELIVERABLE/.test(code)?'本次回答未通过资料与引用核验，未交付。请核对资料或缩小问题范围。':
  '本次回答未能完成，请先刷新会话核对状态；系统不会自动重试。';
 const result=Object.assign(Error(message,{cause:error}),{code:known?code:'KNOWLEDGE_CHAT_FAILED',status:code==='QA_NO_EVIDENCE'?422:409});
 result.getResponse=()=>({code:result.code,message});result.getStatus=()=>result.status;return result;
}
