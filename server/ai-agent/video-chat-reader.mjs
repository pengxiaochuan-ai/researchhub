import {createMediaContentTool} from './media-content-tool.mjs';
import {videoPack,assertVideoPack,videoFail as fail} from './video-chat-contract.mjs';
import {materialDigest} from './session-material-contract.mjs';
const explicit=/(?:视频|录像|录屏|画面|转写|口播|\bvideo\b|\bclip\b)/i;
const action=/(?:分析|解读|总结|概括|识别|描述|提取|看一下|说了|讲了|解释|继续|展开|进一步)/i;
export function isVideoFollowup(text,{previous=false,other=false}={}){
 if(explicit.test(text))return true;
 if(/检索|搜索|查询|查找|寻找|https?:|PubMed|Hub|论文|文献|PDF|DOCX|CSV|XLSX|表格|研究方案|登录|注册|邀请|上传|导入|新建课题/i.test(text))return false;
 if(other)return false;
 return action.test(text)||previous&&/继续|进一步|上述|刚才|原话|这(?:个|些|段|里)?|为什么|如何|能否|是否|局限|证据|颜色|文字|建议|推论|第.{0,8}秒|\d+(?:\.\d+)?\s*秒|\d+:\d{2}|时点/.test(text);
}
export async function reviseVideoCommand({analysis,admit},tx,user,sid,command,question){
 if(command.hubMediaSelection){
  if(isVideoFollowup(question.text,{previous:true})){await analysis.prepareInTx(tx,user,sid,command.hubMediaSelection);return{hubMediaSelection:command.hubMediaSelection};}
  return{hubMediaSelection:null,hubPrivateSelection:null,hubResearchDataSelection:null,...await admit(tx,user,sid,question)};
 }
 const selected=await analysis.captureInTx(tx,user,sid,question);return selected?{hubMediaSelection:selected,hubPrivateSelection:null,hubResearchDataSelection:null}:{};
}
export function chooseVideoEvidence(rows,question,limit=12){
 const unique=[...new Map(rows.map(e=>[e.id,e])).values()].sort((a,b)=>a.startUs-b.startUs||a.id.localeCompare(b.id));
 if(unique.length<=limit)return unique.map(e=>e.id);
 // Spread across the video, retaining both modalities; lexical overlap adds
 // relevant fragments without pretending a sampled result covers all frames.
 const terms=question.match(/[\p{L}]{2,}/gu)??[],score=e=>terms.reduce((n,t)=>n+(e.text.includes(t)?t.length:0),0),selected=new Set();
 for(const kind of ['transcript','frame']){const values=unique.filter(e=>e.kind===kind);for(let i=0;i<Math.min(4,values.length);i++)selected.add(values[Math.floor(i*(values.length-1)/Math.max(1,Math.min(4,values.length)-1))].id);}
 for(const e of [...unique].sort((a,b)=>score(b)-score(a)||a.startUs-b.startUs)){if(selected.size>=limit)break;selected.add(e.id);}
 return unique.filter(e=>selected.has(e.id)).map(e=>e.id);
}
export function createVideoChatReader({access,service}){
 const tool=service?createMediaContentTool({service}):null;
 const inTx=(tx,user,sid,fn)=>access.inTransaction(tx,user,sid,fn);
 async function prepareInTx(tx,user,sid,selection,{audit=false}={}){
  assertVideoPack(selection,user,sid);if(!service)fail('VIDEO_RUNTIME_UNAVAILABLE','视频内容暂不可用，请稍后再试。',503);
  return inTx(tx,user,sid,async(db,u)=>{
   const result=await tool.readInTx(db,u,sid,{mediaId:selection.mediaId,runId:selection.runId,evidenceIds:selection.sources.map(s=>s.evidenceId)},{audit});
   const current=videoPack(u,sid,result,selection.contextQuestion);
   if(current.packHash!==selection.packHash)fail('VIDEO_SOURCE_CHANGED');return current;
  });
 }
 return{prepareInTx,
  async captureInTx(tx,user,sid,question){
   await tx.$queryRawUnsafe(`SELECT set_config('app.account_id',$1,true)`,user.accountId);
   const scope=[user.tenantId,user.studyGroupId,user.researchProjectId,user.accountId,sid];
   const rows=await tx.$queryRawUnsafe(`SELECT id FROM rh_ai.session_media_uploads WHERE tenant_id=$1 AND study_group_id=$2 AND research_project_id=$3 AND account_id=$4 AND session_id=$5 ORDER BY created_at,id LIMIT 2`,...scope);
   if(!rows.length)return null;
   const prior=await tx.knowledgeChatJob.findFirst({where:{tenantId:user.tenantId,accountId:user.accountId,studyGroupId:user.studyGroupId,researchProjectId:user.researchProjectId,sessionId:sid,status:'completed'},orderBy:[{createdAt:'desc'},{id:'desc'}]});
   const previous=prior?.payload?.hubMediaSelection;
   const [other]=await tx.$queryRawUnsafe(`SELECT EXISTS(SELECT 1 FROM rh_ai.session_materials WHERE tenant_id=$1 AND study_group_id=$2 AND research_project_id=$3 AND account_id=$4 AND session_id=$5 AND deleted_at IS NULL) OR EXISTS(SELECT 1 FROM rh_ai.research_data_uploads WHERE tenant_id=$1 AND study_group_id=$2 AND research_project_id=$3 AND account_id=$4 AND session_id=$5) AS present`,...scope);
   const text=question?.text??'';
   if(!isVideoFollowup(text,{previous:Boolean(previous),other:other?.present}))return null;
   if(rows.length!==1||other?.present)fail('HUB_SKILL_CLARIFICATION','本会话有多份不同材料，请在仅含本次视频的会话提问，避免混用来源。',422);
   if(question?.networkIntent?.enabled)fail('HUB_SKILL_CLARIFICATION','请关闭“智能搜索”后再分析本会话视频；私有视频内容不会用于联网搜索。',422);
   if(previous){await prepareInTx(tx,user,sid,previous);return previous;}
   if(!service)fail('VIDEO_RUNTIME_UNAVAILABLE','视频内容暂不可用，请稍后再试。',503);
   return inTx(tx,user,sid,async(db,u)=>{
    const c=await service.current(db,u,sid,rows[0].id);
    const evidence=[];for(const channel of ['audio','visual']){
     const state=c.run.channels[channel];if(!['complete','not_applicable'].includes(state.state))fail('VIDEO_NOT_READY','视频仍在解析，请等转写和画面检查完成后再提问。');
     const found=await db.$queryRawUnsafe(`SELECT body FROM rh_ai.session_media_content_evidence WHERE row_id=$1 AND root_id=$2 AND account_id=$3 AND channel=$4 ORDER BY (body->>'startUs')::bigint,evidence_key`,state.resultRowId??c.run.id,c.root.id,u.accountId,channel);evidence.push(...found.map(x=>x.body));
    }
    const ids=chooseVideoEvidence(evidence,text);if(!ids.length)fail('VIDEO_NO_EVIDENCE','本视频没有可供解读的转写或画面描述，请先播放原视频核对。');
    const result=await tool.readInTx(db,u,sid,{mediaId:c.m.id,runId:c.run.id,evidenceIds:ids},{audit:false});
    return videoPack(u,sid,result,text);
   });
  },
  async verifySource(user,sid,p){assertVideoPack(p,user,sid);if(!service)fail('VIDEO_RUNTIME_UNAVAILABLE');await service.verifySource(user,sid,p.mediaId,p.runId);},
  async execute(user,sid,p){assertVideoPack(p,user,sid);if(!tool)fail('VIDEO_RUNTIME_UNAVAILABLE');const result=await tool.execute({user,sessionId:sid},{mediaId:p.mediaId,runId:p.runId,evidenceIds:p.sources.map(s=>s.evidenceId)});if(materialDigest(videoPack(user,sid,result,p.contextQuestion))!==materialDigest(p))fail('VIDEO_SOURCE_CHANGED');return result;},
 };
}
