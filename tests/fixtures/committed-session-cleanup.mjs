import assert from 'node:assert/strict';

// Test-only cleanup for committed transaction/FIFO tests. Never discover rows by
// a broad prefix: callers register IDs only after creating them in this run.
export async function cleanupCommittedTestSessions({db,scope,sessionIds}){
 const ids=[...sessionIds];if(!ids.length)return{sessions:0};
 const fields=['tenantId','studyGroupId','researchProjectId','accountId'];
 assert(fields.every(k=>typeof scope?.[k]==='string'&&scope[k]));
 assert(ids.every(id=>/^rh-aiq-[A-Za-z0-9_-]{1,150}$/.test(id)));
 return db.$transaction(async tx=>{
  await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtextextended($1,0))','wp01:tenant:'+scope.tenantId);
  await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtextextended($1,0))','aisci-token-quota:'+scope.tenantId);
  await tx.$queryRawUnsafe('SELECT id FROM public.session WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE',ids);
  await tx.$queryRawUnsafe('SELECT id FROM public.knowledge_chat_job WHERE "sessionId"=ANY($1::text[]) ORDER BY id FOR UPDATE',ids);
  const rows=await tx.session.findMany({where:{id:{in:ids}},select:{id:true,tenantId:true,studyGroupId:true,researchProjectId:true,accountId:true}});
  assert.equal(rows.length,ids.length,'Test session ownership changed; preserve data');
  assert(rows.every(row=>fields.every(k=>row[k]===scope[k])),'Test session owner changed; preserve data');
  const jobs=await tx.knowledgeChatJob.findMany({where:{sessionId:{in:ids}},select:{id:true,sessionId:true,requestKey:true,tenantId:true,studyGroupId:true,researchProjectId:true,accountId:true,attempts:true,executionToken:true,workerOwner:true,leaseExpiresAt:true,startedAt:true,assistantMessageId:true,result:true}});
  assert(jobs.every(row=>fields.every(k=>row[k]===scope[k])),'Test job owner changed; preserve data');
  assert(jobs.every(row=>row.attempts===0&&['executionToken','workerOwner','leaseExpiresAt','startedAt','assistantMessageId','result'].every(k=>row[k]==null)),'Execution evidence found; preserve test data');
  if(jobs.length){
   const reservations=await tx.tokenQuotaReservation.count({where:{tenantId:scope.tenantId,requestKey:{in:jobs.map(j=>'chat:'+j.sessionId+':'+j.requestKey)}}});
   assert.equal(reservations,0,'Real billing evidence found; preserve test records');
  }
  const messages=await tx.message.findMany({where:{sessionId:{in:ids}},select:{id:true,tenantId:true,role:true}});
  assert(messages.every(m=>m.tenantId===scope.tenantId&&m.role==='user'),'Unexpected message evidence; preserve test data');
  for(const name of ['artifact','structuredInteraction','researchAgentRun','researchMethodRun','dataAnalysisQuery'])assert.equal(await tx[name].count({where:{sessionId:{in:ids}}}),0,'Unexpected '+name+' child; preserve test data');
  const {researchProjectId,...auditScope}=scope;
  // Legacy command audits may omit projectId; exact new target IDs still bind
  // cleanup to this run, tenant, group and owner.
  const auditWhere={...auditScope,OR:[{researchProjectId},{researchProjectId:null}],target:{in:[...ids,...jobs.map(j=>j.id),...messages.map(m=>m.id)]}};
  const actions=['hub_command_enqueue','hub_command_edit','hub_command_cancel','hub_command_resume','hub_command_dispatch'];
  const audits=await tx.auditLog.findMany({where:auditWhere,select:{id:true,action:true}});
  assert(audits.every(a=>actions.includes(a.action)),'Unexpected business audit; preserve test data');
  await tx.auditLog.deleteMany({where:{...auditWhere,id:{in:audits.map(a=>a.id)},action:{in:actions}}});
  const deleted=await tx.session.deleteMany({where:{...scope,id:{in:ids}}});
  assert.equal(deleted.count,ids.length,'Concurrent session change; rollback cleanup');
  return{sessions:deleted.count};
 },{maxWait:8000,timeout:20000});
}
