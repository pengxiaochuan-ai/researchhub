export const safeId=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(v);
const code=v=>typeof v==='string'&&/^[A-Za-z0-9_.:-]{1,128}$/.test(v);
export const auditError=(status,code,message)=>Object.assign(Error(message),{status,code});
export const actionLabels={
 'researchhub.protocol.create':'创建研究方案','researchhub.protocol.update':'修改研究方案','researchhub.protocol.submit':'提交方案审核','researchhub.protocol.return':'退回研究方案','researchhub.protocol.approve':'批准研究方案','researchhub.protocol.activate':'启用研究方案','researchhub.protocol.check':'检查研究方案','researchhub.protocol.policy.save':'保存研究执行规则',
 directory_team_create:'创建团队草稿',directory_team_save:'保存团队草稿',directory_team_review:'审核团队资料',directory_entity_create:'创建目录档案',directory_assertion_create:'修订目录资料',directory_decision_approve:'批准目录资料',directory_decision_revoke:'撤回目录资料',
 'researchhub.source_review.receipt':'审核来源资料',update_account:'调整账号状态',pi_project_member_change:'维护研究成员',
 'hub.token.reconciled':'处理Token待对账','hub.token.attempt.started':'开始模型请求','hub.token.attempt.completed':'记录模型用量','hub.token.attempt.unknown':'模型用量待核对','hub.token.execution.sealed':'固定执行用量',
 'researchhub.session.logout':'退出登录',wp02_public_registration_confirmed:'完成账号注册',wp02_self_password_reset:'重置本人密码',wp02_member_invitation_issued:'发送研究邀请',wp02_member_invitation_resend:'重发研究邀请',wp02_member_invitation_revoke:'撤销研究邀请',wp02_member_invitation_accepted:'接受研究邀请',
 subject_detail_read:'读取受试者记录',raw_data_content_read:'读取原始资料',subject_export:'导出研究数据',update_subject:'修改受试者记录',release_data_quality_gate:'放行质量结果',research_artifact_review_approved:'批准科研产物',research_artifact_release:'放行科研产物',research_artifact_file_download:'下载科研产物'
};
export function parseAuditQuery(q={}){
 if(!q||typeof q!=='object'||Array.isArray(q)||Object.keys(q).some(k=>!['take','skip','action','target','cursor'].includes(k)))throw auditError(400,'HUB_AUDIT_QUERY_INVALID','查询条件无效。');
 const integer=(v,d,min,max)=>{if(v===undefined)return d;if(!/^(0|[1-9]\d*)$/.test(String(v))||!Number.isSafeInteger(Number(v))||Number(v)<min||Number(v)>max)throw auditError(400,'HUB_AUDIT_QUERY_INVALID','分页条件无效。');return Number(v);};
 if(q.action!==undefined&&!code(q.action)||q.target!==undefined&&!safeId(q.target))throw auditError(400,'HUB_AUDIT_QUERY_INVALID','请选择操作类型或输入有效对象标识。');
 if(q.cursor!==undefined&&(typeof q.cursor!=='string'||q.cursor.length>4096))throw auditError(400,'HUB_AUDIT_QUERY_INVALID','翻页位置无效，请重新查询。');
 return {take:integer(q.take,20,1,100),skip:integer(q.skip,0,0,100000),...(q.cursor?{cursor:q.cursor}:{}),...(q.action?{action:q.action}:{}),...(q.target?{target:q.target}:{})};
}
export function projectAudit(row,actorLabel){return{id:row.id,createdAt:new Date(row.createdAt).toISOString(),actionCode:code(row.action)?row.action:null,actionLabel:Object.hasOwn(actionLabels,row.action)?actionLabels[row.action]:'其他操作',actorLabel:actorLabel||'操作者未记录',objectId:safeId(row.target)?row.target:null,result:'未记录结果'};}
const unavailable=()=>({status:'unavailable',label:'该记录的依据尚不能核验，不能据此判定操作结果',fields:[]});
const states={draft:'草稿',pending_review:'待审核',approved:'已批准',executing:'执行中',released:'已放行',active:'有效',disabled:'已停用'};
export function projectProof(log,proof){
 if(!proof){if(!Object.hasOwn(actionLabels,log.action))return{status:'unrecognized',label:'历史操作类型尚未识别，仅展示基本记录',fields:[]};if(!log.meta||!Object.keys(log.meta).length)return{status:'missing',label:'原记录未保存决定或版本依据',fields:[]};return unavailable();}const r=proof.row,fields=[];
 if(proof.kind==='operation'){
  if(r?.audit_id!==log.id||r.actor_id!==log.accountId||r.action!==(log.action??'').replace(/^researchhub\./,'')||r.target_id!==log.target)return unavailable();
  const p=r.result?.protocol;if(!p||p.id!==log.target||!Number.isSafeInteger(p.versionNumber)||!Object.hasOwn(states,p.status))return unavailable();
  fields.push({label:'方案版本',value:String(p.versionNumber)},{label:'该次提交后的状态',value:states[p.status]});
 }else if(proof.kind==='decision'){
  if(!r||!['approve','revoke','reject'].includes(r.decision)||!Number.isSafeInteger(r.decision_version))return unavailable();
  fields.push({label:'审核决定',value:({approve:'批准',revoke:'撤回',reject:'不批准'})[r.decision]},{label:'决定版本',value:String(r.decision_version)});
 }else if(proof.kind==='team'){
  if(!r||!Number.isSafeInteger(r.version))return unavailable();fields.push({label:'该次团队草稿版本',value:String(r.version)});
 }else if(proof.kind==='account'){
  if(!r||!safeId(r.id)||!Object.hasOwn(states,r.status))return unavailable();fields.push({label:'该次提交后的账号状态',value:states[r.status]});
 }else if(proof.kind==='member'){
  if(!r||!['active','disabled'].includes(r.status)||!['project_manager','researcher','data_manager'].includes(r.roleKey))return unavailable();fields.push({label:'该次成员状态',value:states[r.status]},{label:'研究角色',value:({project_manager:'研究负责人',researcher:'科研人员',data_manager:'数据管理员'})[r.roleKey]});
 }else if(proof.kind==='source'){
  if(!r||!['pmc','external','workbook'].includes(r.kind))return unavailable();fields.push({label:'资料类型',value:({pmc:'开放全文',external:'外部资料',workbook:'书目表格'})[r.kind]});
  return{status:'receipt',label:'原提交回执已保留，展示与AI用途仍以当前审核状态为准',fields};
 }else if(proof.kind==='billing'){
  if(!r||!Number.isSafeInteger(r.actualTokens)||r.actualTokens<0)return unavailable();fields.push({label:'该次已结算Token',value:String(r.actualTokens)});
 }else if(proof.kind==='sensitive'){
  fields.push({label:'记录类型',value:'标准化敏感操作审计'});
 }else return unavailable();
 return{status:'verified',label:'已核对原版本或提交记录',fields};
}
