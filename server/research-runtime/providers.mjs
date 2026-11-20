import{boundWorkerLifecycle,disabledEmbeddings,disabledModelExecution}from'./worker-lifecycle.mjs';
import{HUB_CHAT}from'./chat.mjs';
import{createBoundedChatProvider,fenceBoundedChatQueue,supportsBoundedChatCore}from'./chat-execution.mjs';
import{createRuntimeDocExtractor}from'./knowledge-parser.mjs';
export function createRuntimeProviders({load,require,prisma,scope,cookieName,jwt,storage,embeddingMode,stopGates,modelEnabled=false,createChat,chatBudget,coreDigest}){
 const C=(path,name)=>load(path,name);
 const classes=[
 ['auth/auth.service','AuthService'],
 ['knowledge/retrieval.service','RetrievalService'],['knowledge/ingestion.service','IngestionService'],['knowledge/grounding.service','GroundingService'],['knowledge/knowledge-import.service','KnowledgeImportService'],['knowledge/knowledge.service','KnowledgeService'],['knowledge/kb-tools.service','KbToolsService'],
 ['common/execution-log.service','ExecutionLogService'],['remediation/remediation.service','RemediationCasesService'],['research-methods/data-quality-release.service','DataQualityReleaseService'],['data/data.service','DataService'],['data/data-query-replay.service','DataQueryReplayService'],['research-evidence/research-evidence.service','ResearchEvidenceService'],
 ['orchestrator/research-query-planner','ResearchQueryPlanner'],['orchestrator/skill-invoker','SkillInvoker'],['orchestrator/orchestrator.service','OrchestratorService'],
 ['billing/billing.service','BillingService'],['subject-groups/subject-groups.service','SubjectGroupsService'],['subjects/subjects.service','SubjectsService'],['ingest/raw-processing.service','RawProcessingService'],['ingest/ingest.service','IngestService'],['sessions/sessions.service','SessionsService'],['agents/agents.service','AgentsService']
 ].map(([path,name])=>C(path,name));
 const disabled=disabledModelExecution(),Embedding=C('knowledge/embedding.service','EmbeddingService');
 let bounded;
 if(modelEnabled&&!supportsBoundedChatCore(coreDigest,chatBudget))throw Error('HUB_CHAT_BOUNDED_ADMISSION_REQUIRED');
 const queues=['knowledge-chat-queue','research-agent-runs'].map(path=>({provide:C('sessions/'+path+'.service',path==='research-agent-runs'?'ResearchAgentRunsService':'KnowledgeChatQueueService'),inject:[C('prisma/prisma.service','PrismaService'),path==='knowledge-chat-queue'?HUB_CHAT:C('sessions/sessions.service','SessionsService'),C('common/deployment-scope','DEPLOYMENT_SCOPE')],useFactory:(db,sessions,deployment)=>{
  const instance=new(C('sessions/'+path+'.service',path==='research-agent-runs'?'ResearchAgentRunsService':'KnowledgeChatQueueService'))(path==='knowledge-chat-queue'?sessions.queueFence.prisma:db,path==='knowledge-chat-queue'?sessions.sessions:sessions,deployment);
  if(path==='knowledge-chat-queue'&&chatBudget)fenceBoundedChatQueue(instance,chatBudget,coreDigest);
  return boundWorkerLifecycle(path==='knowledge-chat-queue'?sessions.queueFence.bind(instance):instance,stopGates);
 }}));
 const Pubmed=C('research-evidence/pubmed.client','PubmedClient'),Trials=C('research-evidence/clinical-trials.client','ClinicalTrialsClient'),Chunk=C('sessions/chat-chunk-upload','ChatChunkUploadStore');
 return[
 {provide:C('prisma/prisma.service','PrismaService'),useValue:prisma},
 {provide:C('common/deployment-scope','DEPLOYMENT_SCOPE'),useValue:scope},
 {provide:C('common/deployment-scope','AUTH_COOKIE_NAME'),useValue:cookieName},
 {provide:require('@nestjs/jwt').JwtService,useValue:jwt},
 {provide:C('storage/storage.service','StorageService'),useValue:storage},
 {provide:C('knowledge/doc-extract.service','DocExtractService'),useFactory:()=>createRuntimeDocExtractor({Native:C('knowledge/doc-extract.service','DocExtractService'),PDFParse:require('pdf-parse').PDFParse,resolveMetadata:C('knowledge/knowledge-literature-metadata','resolveLiteratureMetadata'),parserConfigured:Boolean(process.env.KB_DOC_PARSER_URL)})},
 {provide:HUB_CHAT,inject:[C('orchestrator/opencode/opencode-pool','OpencodePool'),C('orchestrator/deepseek.provider','DeepSeekProvider'),C('knowledge/kb-tools.service','KbToolsService'),C('knowledge/grounding.service','GroundingService'),C('billing/billing.service','BillingService'),C('ingest/ingest.service','IngestService'),C('knowledge/knowledge.service','KnowledgeService'),C('knowledge/retrieval.service','RetrievalService')],useFactory:(pool,provider,tools,grounding,billing,ingest,knowledge,retrieval)=>createChat({pool,provider,tools,grounding,billing,ingest,knowledge,retrieval,storage,modelExecution:bounded?.withExecution,knownUsageSample:u=>({...u,cost:C('orchestrator/pricing','estimateCost')(u.model,u.promptTokens,u.completionTokens,u.cacheHitTokens||0)})})},
 {provide:Embedding,...(embeddingMode==='service'?{useClass:Embedding}:{useValue:disabledEmbeddings()})},
 {provide:C('orchestrator/deepseek.provider','DeepSeekProvider'),...(modelEnabled?{useFactory:()=>{bounded=createBoundedChatProvider({raw:new(C('orchestrator/deepseek.provider','DeepSeekProvider'))(),budget:chatBudget,coreDigest,unknownError:(d,r)=>new(C('orchestrator/deepseek.provider','ModelOutcomeUnknownError'))(d,r)});return bounded.provider;}}:{useValue:disabled.provider})},
 {provide:C('orchestrator/opencode/opencode-pool','OpencodePool'),useValue:disabled.pool},
 ...queues,...classes,{provide:Pubmed,useFactory:()=>new Pubmed()},{provide:Trials,useFactory:()=>new Trials()},
 {provide:Chunk,useFactory:()=>new Chunk({maxFileBytes:C('sessions/chat-chunk-upload','configuredChatAttachmentMaxBytes')()})}
 ];
}
