import {HUB_CONTEXT_KEY,HUB_CONVERSATION_PREFIX,isHubConversation} from './hub-agent-contract.mjs';
import {parseArticleContext} from '../server/hub-sources/article-evidence.mjs';
const fail=()=>{throw Object.assign(Error('HUB_HISTORY_INVALID'),{status:400});};
export function hubHistoryQuery(user,agentId,query={}){
 const page=Number(query.page??1),limit=Number(query.limit??20);
 if(Object.keys(query).some(k=>!['page','limit'].includes(k))||!Number.isSafeInteger(page)||page<1||page>10000||!Number.isSafeInteger(limit)||limit<1||limit>50)fail();
 return {where:{tenantId:user.tenantId,accountId:user.accountId,studyGroupId:user.studyGroupId,researchProjectId:user.researchProjectId,agentId,channel:'knowledge',deletedAt:null,
   OR:[{contextKey:HUB_CONTEXT_KEY},{contextKey:{startsWith:HUB_CONVERSATION_PREFIX}},{contextKey:{startsWith:'hub-article:v1:'}}]},
   select:{id:true,title:true,pinned:true,contextKey:true,updatedAt:true,messages:{where:{tenantId:user.tenantId,role:'user'},select:{content:true,meta:true},orderBy:[{createdAt:'asc'},{id:'asc'}],take:1}},orderBy:[{pinned:'desc'},{updatedAt:'desc'},{id:'desc'}],skip:(page-1)*limit,take:limit+1};
}
export function projectHubHistory(session,job){
 const first=session.messages?.[0],original=first?.meta?.hubCommand?.originalText;
 const prompt=typeof original==='string'&&original.trim()?original:first?.content;
 const base={id:session.id,title:(session.manuallyNamed?session.title:prompt||session.title)||'新对话',manuallyNamed:Boolean(session.manuallyNamed),pinned:Boolean(session.pinned),updatedAt:session.updatedAt,hasPrompt:Boolean(prompt)};
 if(isHubConversation(session.contextKey))return {...base,kind:'hub'};
 const binding=parseArticleContext(session.contextKey);if(!binding)fail();
 return {...base,kind:'article',recordId:binding.recordId,...(job?.requestKey&&/^[a-f0-9]{64}$/.test(job.payload?.articleInputHash??'')?{recovery:{requestKey:job.requestKey,inputHash:job.payload.articleInputHash}}:{})};
}
export async function projectHubHistoryPage(rows,user,db,limit){
 const names=rows.length?await db.auditLog.findMany({where:{tenantId:user.tenantId,accountId:user.accountId,studyGroupId:user.studyGroupId,researchProjectId:user.researchProjectId,action:'hub_session_rename',target:{in:rows.slice(0,limit).map(s=>s.id)}},select:{target:true},distinct:['target']}):[];
 const renamed=new Set(names.map(x=>x.target));
 return Promise.all(rows.slice(0,limit).map(async original=>{
  const session={...original,manuallyNamed:renamed.has(original.id)};
  const item=projectHubHistory(session);
  if(item.kind==='hub')return item;
  const job=await db.knowledgeChatJob.findFirst({where:{tenantId:user.tenantId,accountId:user.accountId,studyGroupId:user.studyGroupId,researchProjectId:user.researchProjectId,sessionId:session.id},orderBy:[{createdAt:'desc'},{id:'desc'}],select:{requestKey:true,payload:true}});
  return projectHubHistory(session,job);
 }));
}
