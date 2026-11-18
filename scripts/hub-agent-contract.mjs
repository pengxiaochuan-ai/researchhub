// Hub evidence has a distinct persisted provenance even though the unchanged
// old Orchestrator exposes only its fixed kb_search tool slot.
import {isDeepStrictEqual} from 'node:util';
export const HUB_CONTEXT_KEY='hub:lingshu-xinyu';
export const HUB_CONVERSATION_PREFIX=HUB_CONTEXT_KEY+':conversation:';
export const isHubConversation=contextKey=>contextKey===HUB_CONTEXT_KEY||typeof contextKey==='string'&&/^hub:lingshu-xinyu:conversation:[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(contextKey);
export const HUB_TOOL_KB_ID='rh_hub_lingshu_xinyu';
// Scope is fixed by the server, not inferred from words such as “不新增”.
export const hubCoreQuestion='请依据当前授权资料回答科研问题。';
export function bindHubSynthesisQuestion(messages,question){
 const prefix='用户问题：'+hubCoreQuestion+'\n';
 if(messages.length!==2||messages[1]?.role!=='user'||!messages[1].content?.startsWith(prefix))throw Error('HUB_SYNTHESIS_INPUT_CHANGED');
 return [messages[0],{...messages[1],content:'用户问题：'+question+'\n'+messages[1].content.slice(prefix.length)}];
}
export const isHubSession=session=>isHubConversation(session?.contextKey)||session?.contextKey?.startsWith('hub-article:')===true;

export function assertHubToolResult(result){
  const sources=result?.meta?.sources;
  if(result?.mutated!==false||result?.meta?.toolName!=='hub_source_search'||
      !Array.isArray(sources)||sources.length<1||sources.length>20||
      !sources.every(source=>(/^rhsr-[a-f0-9]{40}$/.test(source?.sourceRecordId??'')&&!source?.externalDocumentId&&!source?.pmcRecordId||
        /^rhed-[a-f0-9]{40}$/.test(source?.externalDocumentId??'')&&!source?.sourceRecordId&&!source?.pmcRecordId||
        /^pmc-PMC[1-9][0-9]{0,10}$/.test(source?.pmcRecordId??'')&&!source?.sourceRecordId&&!source?.externalDocumentId)&&
        /^[a-f0-9]{64}$/.test(source?.snippetHash??'')&&!('docId'in source))||
      !String(result.result??'').startsWith('[1]'))throw new Error('HUB_AGENT_NO_EVIDENCE');
  return sources;
}

export const hubAnswerProvenance=(sources,tools,articleEvidence)=>{
  if(articleEvidence&&(sources.length!==1||!isDeepStrictEqual(sources[0],articleEvidence.source)))throw Error('ARTICLE_EVIDENCE_CHANGED');
  return {
  hubSources:sources,hubTools:tools,sourceType:new Set(sources.map(source=>source.externalDocumentId
    ? 'hub-reviewed-external-metadata':source.pmcRecordId?'hub-reviewed-pmc-article':'hub-reviewed-publication')).size>1
    ? 'hub-reviewed-mixed'
    : sources[0]?.externalDocumentId?'hub-reviewed-external-metadata'
      : sources[0]?.pmcRecordId?'hub-reviewed-pmc-article':'hub-reviewed-publication',
  answerScope:articleEvidence?'fixed-reviewed-article':'current-reviewed-hub',sourcePolicy:'rh-hub-reviewed-source-v1',syntheticOnly:true,
  ...(articleEvidence?{articleEvidence}:{}),
};};

export async function projectHubMessages(messages,checkSources){
  const projected=[];
  for(const message of messages){
    if(message.role!=='assistant'){projected.push(message);continue;}
    const sources=message.meta?.provenance?.hubSources??[];
    let current=sources.length>0;
    if(current)try{await checkSources(sources);}catch{current=false;}
    projected.push(current?{...message,meta:{...message.meta,sourceStatus:'current'}}:
      {...message,content:'该 Hub 回答的来源已撤回、变更或访问授权已失效，原回答与来源不再交付。',meta:{sourceStatus:'restricted'}});
  }
  return projected;
}
