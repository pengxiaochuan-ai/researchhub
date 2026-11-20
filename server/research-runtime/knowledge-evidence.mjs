import {buildSourceSnapshot,sourceState} from '../../scripts/knowledge-ai-contract.mjs';

const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value);
const fail=(code,status=409)=>{throw Object.assign(Error(code),{code,status});};
export function knowledgeContextId(contextKey){
 if(typeof contextKey!=='string'||!contextKey.startsWith('kb:')||!id(contextKey.slice(3)))fail('KNOWLEDGE_CONTEXT_INVALID',400);
 return contextKey.slice(3);
}
const sameParents=(child,parent)=>['tenantId','studyGroupId','researchProjectId'].every(key=>child?.[key]===parent?.[key]);

// The caller supplies the native current-read fence and native visibility query.
// Explicit transaction callers MUST supply native authorization in that same
// transaction; a fresh read transaction cannot authorize an assistant commit.
export function createKnowledgeEvidence({readCurrent,authorizeInTransaction,authorizePurpose,accessibleKbIds,search,compileQuery=query=>({query})}){
 if(![readCurrent,authorizeInTransaction,authorizePurpose,accessibleKbIds,search].every(f=>typeof f==='function'))throw Error('KNOWLEDGE_EVIDENCE_DEPENDENCIES_REQUIRED');
 const read=(user,fn,tx)=>tx?Promise.resolve().then(()=>authorizeInTransaction(tx,user)).then(()=>fn(tx)):readCurrent(user,fn);
 async function base(tx,user,kbId){
  if(!id(kbId))fail('KNOWLEDGE_CONTEXT_INVALID',400);
  const visible=await accessibleKbIds(user,[kbId],tx);
  if(!visible.includes(kbId))fail('KNOWLEDGE_SOURCE_RESTRICTED',403);
  const kb=await tx.knowledgeBase.findUnique({where:{id:kbId}});
  if(!kb||kb.id!==kbId||!(kb.tenantId===null&&kb.studyGroupId===null&&kb.researchProjectId===null||sameParents(kb,user)))fail('KNOWLEDGE_SOURCE_RESTRICTED',403);
  await authorizePurpose(tx,user,kbId);
  return kb;
 }
 async function records(tx,kb,source){
  if(source?.kbId!==kb.id||!id(source.docId)||!id(source.chunkId))fail('KNOWLEDGE_SOURCE_CHANGED');
  const doc=await tx.knowledgeDoc.findUnique({where:{id:source.docId}});
  const chunk=await tx.knowledgeChunk.findUnique({where:{id:source.chunkId}});
  // Native docs/chunks inherit Study through their KB; neither has a project field.
  if(!doc||doc.id!==source.docId||doc.kbId!==kb.id||doc.tenantId!==kb.tenantId||doc.studyGroupId!==kb.studyGroupId||chunk&&(
   chunk.tenantId!==doc.tenantId||chunk.studyGroupId!==doc.studyGroupId||chunk.id!==source.chunkId||chunk.docId!==doc.id||chunk.kbId!==kb.id))fail('KNOWLEDGE_SOURCE_CHANGED');
  return{doc,chunk};
 }
 async function states(tx,user,kbId,sources){
  if(!Array.isArray(sources)||!sources.length||sources.length>6)fail('KNOWLEDGE_SOURCE_CHANGED');
  const kb=await base(tx,user,kbId),values=[];
  await authorizePurpose(tx,user,kbId,sources);
  for(const source of sources){
   const {doc,chunk}=await records(tx,kb,source);
   const state=sourceState(source,doc,chunk);
   values.push(state==='current'&&(!['vector','keyword'].includes(source.via)||source.quote!==chunk.text.slice(0,500).replace(/\s+/g,' ').slice(0,200)||
    source.page!==(chunk.page??null)||source.section!==(chunk.section??null)||source.docTitle!==doc.title||source.kbName!==kb.name)?'restricted':state);
  }
  return values;
 }
 return{
  authorize:(user,kbId,tx)=>read(user,actual=>base(actual,user,kbId),tx),
  async prepare(user,kbId,query){
   if(typeof query!=='string'||!query.trim())fail('KNOWLEDGE_QUERY_INVALID',400);
   await read(user,tx=>base(tx,user,kbId));
   const compiled=compileQuery(query);
   if(!compiled?.query?.trim())fail('QA_NO_EVIDENCE',422);
   const hits=await search(user,{query:compiled.query,kbIds:[kbId],topK:6});
   if(!Array.isArray(hits)||hits.length>6)fail('KNOWLEDGE_SOURCE_CHANGED');
   if(!hits.length)fail('QA_NO_EVIDENCE',422);
   return read(user,async tx=>{
    const kb=await base(tx,user,kbId),sources=[];
    for(const hit of hits){
     const {doc,chunk}=await records(tx,kb,hit);
     if(!chunk||!['vector','keyword'].includes(hit.via)||hit.page!==chunk.page||hit.section!==chunk.section)fail('KNOWLEDGE_SOURCE_CHANGED');
     try{sources.push(buildSourceSnapshot({...hit,docTitle:doc.title,kbName:kb.name},doc,chunk));}
     catch{fail('KNOWLEDGE_SOURCE_CHANGED');}
    }
    await authorizePurpose(tx,user,kbId,sources);
    return{kbId,query,retrievalQuery:compiled.query,retrievalPolicy:compiled.policy,sources,tool:{mutated:false,result:sources.map((s,i)=>`[${i+1}] 《${s.docTitle}》(${s.kbName}) docId=${s.docId}：${s.quote}`).join('\n')}};
   });
  },
  async validate(user,kbId,sources,tx){
   const current=await read(user,actual=>states(actual,user,kbId,sources),tx);
   if(current.some(s=>s!=='current'))fail('KNOWLEDGE_SOURCE_CHANGED');
  },
  async status(user,kbId,source){
   try{return(await read(user,tx=>states(tx,user,kbId,[source])))[0];}
   catch{return'restricted';}
  },
  async project(user,kbId,messages){
   return read(user,async tx=>{
    await base(tx,user,kbId);
    const projected=[];
    for(const message of messages){
     if(message.role!=='assistant'){projected.push(message);continue;}
     let current=[];
     try{current=await states(tx,user,kbId,message.meta?.provenance?.knowledgeSources);}
     catch{current=['restricted'];}
     projected.push(current.includes('restricted')?{...message,content:'该回答的资料或访问权限已变化，原回答暂不可查看。',meta:{sourceStatus:'restricted'}}:
      {...message,meta:{...message.meta,sourceStatus:current.includes('stale')?'stale':'current'}});
    }
    return projected;
   });
  },
 };
}
