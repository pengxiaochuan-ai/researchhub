import {readFile,mkdir,mkdtemp,appendFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import {join} from 'node:path';
import {routeDigest} from './skill-routing.mjs';
import {createPubmedMcp} from './pubmed-mcp.mjs';
import {retrievePubmed} from './literature-retrieval.mjs';
import {runOpenCodeSynthesis} from './opencode-synthesis.mjs';
import {LITERATURE_INSTRUCTION,acceptLiteratureOutput} from './literature-output.mjs';
import {buildDirectionFacts} from './direction-consistency.mjs';
import {buildSnapshotPack,assertSnapshotPack} from './interpretation-evidence.mjs';
import {INTERPRETATION_INSTRUCTION,acceptInterpretationOutput} from './interpretation-output.mjs';
import {articleResponseMessages} from '../../scripts/article-response-policy.mjs';
import {isLiteratureRequest,assertLiteratureRequest,literaturePlanInput,acceptLiteraturePlan,NATURAL_PLAN_INSTRUCTION,NATURAL_PLAN_POLICY_HASH} from './natural-literature-plan.mjs';
const fail=code=>{throw Object.assign(Error(code),{code});};
export function assertLiteratureEvidence(e){
 if(!e||e.schema!=='hub-literature-evidence.v1')fail('HUB_LITERATURE_EVIDENCE_CHANGED');
 const {hash,...body}=e;if(routeDigest(body)!==hash)fail('HUB_LITERATURE_EVIDENCE_CHANGED');return e;
}
export function literatureSynthesisInput(turn){
 if(turn.literature.plan.schema==='hub-interpretation-query.v1')return JSON.stringify({question:turn.query,continuation:turn.continuationInstruction??null,scope:'当前固定文献选段／检索时摘要，不是全文审阅，不执行外部检索',articles:turn.literature.selected.map(s=>{
  const data=JSON.parse(articleResponseMessages('',turn.query,s.pack)[1].content);
  return{id:s.id,...data,fragments:data.fragments.map(f=>({...f,id:s.id+':'+f.id})),numericFacts:data.numericFacts.map(f=>({...f,fragmentId:s.id+':'+f.fragmentId}))};
 })});
 return JSON.stringify({question:turn.query,continuation:turn.continuationInstruction??null,plan:turn.literature.plan,scope:turn.literature.external?'PubMed实时摘要与当前Hub获准选段':'当前Hub获准选段',sources:turn.literature.selected.map(s=>({id:s.id,title:s.title,text:s.text,coverage:s.coverage})),...(turn.literature.plan.outputs?.includes('directions')?{directionFacts:buildDirectionFacts(turn.literature.selected),directionCheck:'以下为服务端从本次固定材料提取的原句线索，不是完整研究分类。protocol不是完成试验，review引用RCT不等于自身为RCT。reported只表示出现实际评估时间，不自行判为长期；not-mentioned不等于原研究未做。全局仅一篇等说法须核对全部sources，不能靠局部sourceIds排除反例。不得由本次少量摘要断言全领域空白、首次或唯一。不把未读到写成未比较、未分析、未测量或缺乏方案，不自行评价随访短/长。拿不准时明确当前摘要不足以判断并建议核对，不补造事实。每条观察与每条局限用独立完整句表达，避免删去无依据句时连带其他发现。'}:{}),limitations:turn.literature.hubOmission});
}
export function createLiteratureSession({root,tenantId,transaction,routing,hubSearch,hubCurrent,loadFixedArticle,assertFixedArticleInTx,createMcp=createPubmedMcp,runSynthesis=runOpenCodeSynthesis,executionCurrent=async()=>{}}){
 const rootPath=root instanceof URL?fileURLToPath(root):root;
 const where=turn=>({id:turn.jobId,tenantId,accountId:turn.user.accountId,studyGroupId:turn.user.studyGroupId,researchProjectId:turn.user.researchProjectId,sessionId:turn.sessionId});
 const authorize=async turn=>{await routing.validate(turn.user,turn.sessionId,turn.jobId,turn.skillRoute);await executionCurrent(turn);turn.signal?.throwIfAborted();return true;};
 const isInterpretation=e=>e.plan.schema==='hub-interpretation-query.v1';
 function naturalPlan(record,route){
  const{hash,...body}=record??{},request=assertLiteratureRequest(route.decision.taskPlan);
  if(record?.schema!=='hub-literature-planning.v1'||routeDigest(body)!==hash||record.routeHash!==route.snapshotHash||record.requestHash!==request.hash||record.policyHash!==NATURAL_PLAN_POLICY_HASH||record.runtime?.runtime!=='hub-opencode'||acceptLiteraturePlan(record.proposal,request).hash!==record.plan?.hash)fail('HUB_LITERATURE_PLAN_CHANGED');
  return record.plan;
 }
 async function parentInTx(tx,turn,plan){
  const parent=await tx.knowledgeChatJob.findFirst({where:{tenantId,accountId:turn.user.accountId,studyGroupId:turn.user.studyGroupId,researchProjectId:turn.user.researchProjectId,sessionId:turn.sessionId,id:plan.parentJobId,status:'completed'}});
  if(!parent?.payload?.hubSkillRoute)fail('HUB_INTERPRETATION_PARENT_CHANGED');
  await routing.validateInTx(tx,turn.user,turn.sessionId,parent.id,parent.payload.hubSkillRoute,true);
  const e=assertLiteratureEvidence(parent.payload.hubLiteratureEvidence);
  if(e.hash!==plan.parentEvidenceHash||plan.selectedIds.some(id=>!e.selected.some(s=>s.id===id)))fail('HUB_INTERPRETATION_PARENT_CHANGED');return e;
 }
 async function checkInterpretation(tx,turn,e,{publication=false}={}){
  const parent=await parentInTx(tx,turn,e.plan);
  if(e.selected.length!==e.plan.selectedIds.length)fail('HUB_INTERPRETATION_EVIDENCE_CHANGED');
  for(const s of e.selected){
   const original=parent.selected.find(p=>p.id===s.id),{pack,...source}=s;
   if(!e.plan.selectedIds.includes(s.id)||routeDigest(original)!==routeDigest(source))fail('HUB_INTERPRETATION_EVIDENCE_CHANGED');
   if(s.pmcRecordId){if(!assertFixedArticleInTx)fail('HUB_INTERPRETATION_DEPENDENCY_MISSING');await assertFixedArticleInTx(tx,turn.user,pack,{lock:publication});}
   else{assertSnapshotPack(pack);if(buildSnapshotPack(original).packHash!==pack.packHash)fail('HUB_INTERPRETATION_EVIDENCE_CHANGED');}
  }
 }
 async function validateInTx(tx,turn,e,options){
  await routing.validateInTx(tx,turn.user,turn.sessionId,turn.jobId,turn.skillRoute);
  await executionCurrent(turn,tx);
  const job=await tx.knowledgeChatJob.findFirst({where:{...where(turn),status:'processing'}}),stored=assertLiteratureEvidence(job?.payload?.hubLiteratureEvidence);
  const plan=isLiteratureRequest(turn.skillRoute.decision.taskPlan)?naturalPlan(job.payload.hubNaturalPlan,turn.skillRoute):turn.skillRoute.decision.taskPlan;
  if(stored.hash!==e.hash||stored.routeHash!==turn.skillRoute.snapshotHash||stored.plan.hash!==plan.hash)fail('HUB_LITERATURE_EVIDENCE_CHANGED');
  if(isInterpretation(stored))await checkInterpretation(tx,turn,stored,options);
  return stored;
 }
 async function persist(turn,evidence){
  await authorize(turn);
  await transaction(async tx=>{
   await routing.validateInTx(tx,turn.user,turn.sessionId,turn.jobId,turn.skillRoute);
   await executionCurrent(turn,tx);
   const job=await tx.knowledgeChatJob.findFirst({where:{...where(turn),status:'processing'}});if(!job)fail('HUB_LITERATURE_JOB_CHANGED');
   if(isInterpretation(evidence))await checkInterpretation(tx,turn,evidence);
   const updated=await tx.knowledgeChatJob.updateMany({where:{...where(turn),status:'processing',payload:{equals:job.payload}},data:{payload:{...job.payload,hubLiteratureEvidence:evidence}}});
   if(updated.count!==1)fail('HUB_LITERATURE_JOB_CHANGED');
  },turn.user);return evidence;
 }
 async function prepare(turn){
  await authorize(turn);let plan=turn.skillRoute.decision.taskPlan;
  if(isLiteratureRequest(plan))plan=await transaction(async tx=>{await routing.validateInTx(tx,turn.user,turn.sessionId,turn.jobId,turn.skillRoute);const job=await tx.knowledgeChatJob.findFirst({where:{...where(turn),status:'processing'}});return naturalPlan(job?.payload?.hubNaturalPlan,turn.skillRoute);},turn.user);
  const prior=await transaction(async tx=>{await routing.validateInTx(tx,turn.user,turn.sessionId,turn.jobId,turn.skillRoute);return(await tx.knowledgeChatJob.findFirst({where:{...where(turn),status:'processing'}}))?.payload?.hubLiteratureEvidence;},turn.user);
  if(prior){assertLiteratureEvidence(prior);await validate(turn,prior);return prior;}
  if(plan.schema==='hub-interpretation-query.v1'){
   const parent=await transaction(tx=>parentInTx(tx,turn,plan),turn.user),selected=[];
   for(const id of plan.selectedIds){
    const source=parent.selected.find(s=>s.id===id);let pack;
    if(source.pmcRecordId){
     if(!loadFixedArticle)fail('HUB_INTERPRETATION_DEPENDENCY_MISSING');
     pack=await loadFixedArticle(turn.user,source);
     if(['articleVersion','rawSha256','reviewVersion'].some(k=>pack.source[k]!==source[k]))fail('HUB_INTERPRETATION_PARENT_CHANGED');
    }else pack=buildSnapshotPack(source);
    selected.push({...source,pack});
   }
   const hubSources=parent.hubSources.filter(s=>selected.some(r=>r.id&&parent.selected.find(p=>p.id===r.id&&p.kind==='hub-reviewed'&&p.pmcRecordId===s.pmcRecordId&&p.sourceRecordId===s.sourceRecordId&&p.externalDocumentId===s.externalDocumentId)));
   if(hubSources.length)await hubCurrent(turn.user,hubSources);
   const data={schema:'hub-literature-evidence.v1',routeHash:turn.skillRoute.snapshotHash,plan,hubSources,external:null,selected,tools:[{tool:'hub_fixed_interpretation_evidence',status:'complete',runtime:'hub-backend',parentJobId:plan.parentJobId,parentEvidenceHash:plan.parentEvidenceHash,createdAt:new Date().toISOString()}],createdAt:new Date().toISOString()};
   return persist(turn,{...data,hash:routeDigest(data)});
  }
  // Year/design restrictions are not silently ignored on the Hub side.
  const hubResult=plan.date||plan.design?{result:'',meta:{sources:[]}}:await hubSearch(turn.user,plan.question,plan.localPlan);
  const hubSources=hubResult.meta.sources,hubText=hubResult.meta.sourceTexts??[];
  if(hubSources.length!==hubText.length)fail('HUB_LITERATURE_SOURCE_BINDING');
  let external=null;const tools=[];
  if(plan.scope==='hub-and-pubmed'){
   // Execution gate is independent from the model proposal and route label.
   if(typeof routing.assertNetwork!=='function')fail('HUB_NETWORK_DISABLED');
   await routing.assertNetwork(turn.user,turn.sessionId,turn.jobId);
   const base=join(rootPath,'.superpowers/sdd/qiyan-ai-nine-skills-2026-11-06/t06');await mkdir(base,{recursive:true,mode:0o700});
   const cwd=await mkdtemp(join(base,'mcp-'));
   const mcp=await createMcp({cwd,authorize:async()=>{await authorize(turn);return routing.assertNetwork(turn.user,turn.sessionId,turn.jobId);},signal:turn.signal,record:async event=>{tools.push(event);await appendFile(join(cwd,'calls.jsonl'),JSON.stringify(event)+'\n',{mode:0o600});}});
   try{external=await retrievePubmed({plan,call:mcp.call,signal:turn.signal});}finally{await mcp.close();}
  }
  const candidates=[...hubSources.slice(0,external?1:plan.maxResults).map((s,i)=>({...s,id:'H'+(i+1),kind:'hub-reviewed',coverage:'fragment',text:hubText[i]})),...(external?.sources??[]).map((s,i)=>({...s,id:'P'+(i+1),text:s.abstract}))];
  const seen=new Set(),selected=candidates.filter(s=>{const key=s.doi?.toLowerCase()??s.title.toLowerCase();if(seen.has(key))return false;seen.add(key);return true;}).slice(0,plan.maxResults);
  if(!selected.length)fail('HUB_LITERATURE_NO_EVIDENCE');
  const data={schema:'hub-literature-evidence.v1',routeHash:turn.skillRoute.snapshotHash,plan,hubSources:hubSources.filter(s=>selected.some(r=>r.kind==='hub-reviewed'&&r.pmcRecordId===s.pmcRecordId&&r.sourceRecordId===s.sourceRecordId&&r.externalDocumentId===s.externalDocumentId)),external,selected,tools,
   hubOmission:plan.date||plan.design?'本次Hub投影未支持这些限定，仅使用PubMed满足限定的结果。':null,createdAt:new Date().toISOString()};
  return persist(turn,{...data,hash:routeDigest(data)});
 }
 async function validate(turn,e){assertLiteratureEvidence(e);await transaction(tx=>validateInTx(tx,turn,e),turn.user);if(e.hubSources.length)await hubCurrent(turn.user,e.hubSources);turn.signal?.throwIfAborted();}
 return{prepare,validate,validateInTx,
  async plan(turn,providerCall,recordUsage){
   await authorize(turn);const request=assertLiteratureRequest(turn.skillRoute.decision.taskPlan);
   const prior=await transaction(async tx=>{await routing.validateInTx(tx,turn.user,turn.sessionId,turn.jobId,turn.skillRoute);return(await tx.knowledgeChatJob.findFirst({where:{...where(turn),status:'processing'}}))?.payload?.hubNaturalPlan;},turn.user);
   if(prior)return naturalPlan(prior,turn.skillRoute);
   let result;
   try{
    result=await runSynthesis({root:rootPath,tenantId,instruction:NATURAL_PLAN_INSTRUCTION,text:JSON.stringify(literaturePlanInput(request)),authorize:()=>authorize(turn),signal:turn.signal,providerCall});
    recordUsage(result);
    if(turn.providerFinishReason==='length')fail('HUB_LITERATURE_PLAN_TRUNCATED');
    const plan=acceptLiteraturePlan(result.text,request),data={schema:'hub-literature-planning.v1',routeHash:turn.skillRoute.snapshotHash,requestHash:request.hash,policyHash:NATURAL_PLAN_POLICY_HASH,plan,proposal:result.text,runtime:result.runtimeEvidence},record={...data,hash:routeDigest(data)};
    await authorize(turn);
    await transaction(async tx=>{
     await routing.validateInTx(tx,turn.user,turn.sessionId,turn.jobId,turn.skillRoute);
     await executionCurrent(turn,tx);
     const job=await tx.knowledgeChatJob.findFirst({where:{...where(turn),status:'processing'}});if(!job||job.payload.hubNaturalPlan)fail('HUB_LITERATURE_PLAN_CHANGED');
     const changed=await tx.knowledgeChatJob.updateMany({where:{...where(turn),status:'processing',payload:{equals:job.payload}},data:{payload:{...job.payload,hubNaturalPlan:record}}});if(changed.count!==1)fail('HUB_LITERATURE_PLAN_CHANGED');
    },turn.user);return plan;
   }catch(reason){if(!result&&reason.knownProviderResult)recordUsage(reason.knownProviderResult);throw reason;}
  },
  async synthesize(turn,providerCall){
   await validate(turn,turn.literature);
   // Load the selected source method, not all nine skills or Feishu templates.
   const interpreting=isInterpretation(turn.literature);
   const method=await readFile(join(rootPath,interpreting?'skill/doubao-medical-literature-interpretation/SKILL.md':'skill/doubao-medical-literature-search/references/evidence-sources-and-appraisal.md'),'utf8');
   const core=interpreting?method.slice(method.indexOf('## 5.'),method.indexOf('## 6.')):method.slice(method.indexOf('### 核心证据准入'),method.indexOf('### 默认证据覆盖量'));
   if(!core.trim())fail('HUB_SKILL_SOURCE_CHANGED');
   const directions=turn.literature.plan.outputs?.includes('directions')?'\n本次还需候选研究方向。JSON追加directions数组，一至三项，每项含direction、rationale、limitation三个简短定性字符串和sourceIds（仅本次真实输入id）。direction只提出下一步可检验的问题，不包装为已证实的新方向。rationale先忠实说明所引摘要实际发现及相反结果，再说明本次材料尚未充分回答的问题；不得由本次少量摘要宣称整个领域缺乏或尚无某类研究。若已有药物/心理/假治疗比较，不能说缺乏这些直接比较，应具体提出尚需扩检确认的比较条件、长期效果或经济性问题。生理指标改善不等于症状/倦怠改善，主要结局阴性或恶化时必须保留，不把相关性写成机制已经证实。limitation明确需要扩检、全文核对或新研究验证；不生成临床建议或计算。各篇reason简短，summary、limitations各简洁一段，勿重复题名。输出前逐项对照sourceIds的原摘要，删去与之相反的表述。':'';
   const instruction=core+'\n【ResearchHub执行适配，优先于原平台交付要求；本轮只交付受限聊天解读，不创建飞书或全文报告】\n'+(interpreting?INTERPRETATION_INSTRUCTION:LITERATURE_INSTRUCTION)+directions;
   const text=literatureSynthesisInput(turn);
   const result=await runOpenCodeSynthesis({root:rootPath,tenantId,instruction,text,authorize:()=>authorize(turn),signal:turn.signal,providerCall});
   turn.literatureRuntime=result.runtimeEvidence;return result;
  },
  accept(turn,result){const accepted=isInterpretation(turn.literature)?acceptInterpretationOutput(result.text,turn.literature):acceptLiteratureOutput(result.text,turn.literature);result.text=accepted.text;turn.literatureOutput=accepted.validation;},
  async project(user,session,messages){return Promise.all(messages.map(async m=>{
   if(!m.meta?.provenance?.literatureEvidence)return m;
   try{
    const e=assertLiteratureEvidence(m.meta.provenance.literatureEvidence),output=m.meta.provenance.literatureOutput;
    const job=await transaction(tx=>tx.knowledgeChatJob.findFirst({where:{tenantId,accountId:user.accountId,studyGroupId:user.studyGroupId,researchProjectId:user.researchProjectId,sessionId:session.id,assistantMessageId:m.id,status:'completed'}}),user);
    if(!job||assertLiteratureEvidence(job.payload.hubLiteratureEvidence).hash!==e.hash||output?.evidenceHash!==e.hash||output.textHash!==routeDigest(m.content)||m.meta.provenance.literatureRuntime?.runtime!=='hub-opencode')fail('HUB_LITERATURE_RESULT_CHANGED');
    if(isLiteratureRequest(job.payload.hubSkillRoute.decision.taskPlan)&&naturalPlan(job.payload.hubNaturalPlan,job.payload.hubSkillRoute).hash!==e.plan.hash)fail('HUB_LITERATURE_PLAN_CHANGED');
    if(isInterpretation(e))await transaction(tx=>checkInterpretation(tx,{user,sessionId:session.id},e),user);
    if(e.hubSources.length)await hubCurrent(user,e.hubSources);return{...m,meta:{...m.meta,sourceStatus:'current'}};
   }catch{return{...m,content:'此回答的来源或访问授权已变化，当前无法交付。',meta:{sourceStatus:'restricted'}};}
  }));},
 };
}
