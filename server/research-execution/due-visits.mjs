import {invalid,only,researchError} from '../research-studies/contract.mjs';
const timeZone='Asia/Shanghai',offset=8*60*60*1000;
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value);
const scopeOf=ctx=>({tenantId:ctx.tenantId,studyGroupId:ctx.studyGroupId,researchProjectId:ctx.executionProjectId});
const scopeSelect={tenantId:true,studyGroupId:true,researchProjectId:true};
const activeProtocols=['executing','superseded'];
function calendar(now){const instant=Number(now());if(!Number.isFinite(instant))throw Error('DUE_VISIT_CLOCK_UNAVAILABLE');const day=new Date(instant+offset).toISOString().slice(0,10),start=new Date(day+'T00:00:00+08:00');return{day,start,end:new Date(start.getTime()+86400000)};}
function cursorValue(value){
 if(typeof value!=='string'||!value.length||value.length>2048||!/^[A-Za-z0-9_-]+$/.test(value))invalid();let text,c;
 try{const bytes=Buffer.from(value,'base64url');if(bytes.toString('base64url')!==value)invalid();text=bytes.toString('utf8');c=JSON.parse(text);}catch{invalid();}
 if(!c||Array.isArray(c)||JSON.stringify(c)!==text||Object.keys(c).sort().join(',')!=='actor,afterId,authVersion,day,schema,studyId,tenant,timeZone'||c.schema!==1||!id(c.actor)||!id(c.tenant)||!id(c.studyId)||!id(c.afterId)||!Number.isSafeInteger(c.authVersion)||c.authVersion<0||c.timeZone!==timeZone||typeof c.day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(c.day))invalid();
 const parsed=new Date(c.day+'T00:00:00Z');if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==c.day)invalid();return c;
}
const iso=value=>value==null?null:new Date(value).toISOString();
function assertBinding(row,s){
 const same=entity=>!!entity&&Object.entries(s).every(([k,v])=>entity[k]===v);
 if(!id(row.id)||![row,row.subject,row.enrollment,row.visitPlan,row.protocolVersion].every(same)||row.subject.id!==row.subjectId||row.enrollment.id!==row.enrollmentId||row.enrollment.subjectId!==row.subjectId||row.visitPlan.id!==row.visitPlanId||row.protocolVersion.id!==row.protocolVersionId||row.enrollment.protocolVersionId!==row.protocolVersionId||row.visitPlan.protocolVersionId!==row.protocolVersionId||row.subject.acceptanceFixture!==false||row.subject.deletedAt!==null||row.enrollment.acceptanceFixture!==false||row.protocolVersion.acceptanceFixture!==false||row.acceptanceFixture!==false)throw researchError(409,'DUE_VISIT_BINDING_UNAVAILABLE','访视与被试、入组或固定方案的关联尚需核对，请联系研究负责人。');
}
export function createDueVisitsService({studies,core,now=Date.now}){
 return{list:(principal,studyId,query={})=>{
  only(query,['limit','cursor']);if(!id(studyId))invalid();const limit=query.limit??'5';if(typeof limit!=='string'||!/^[1-9]\d{0,2}$/.test(limit)||Number(limit)>100)invalid();const cursor=query.cursor===undefined?null:cursorValue(query.cursor);
  return studies.withResearchStudyTransaction(principal,studyId,'read',async(tx,ctx)=>{
   const s=scopeOf(ctx),actor=await core.authorize(tx,principal,s.studyGroupId,s.researchProjectId,'read');
   if(!actor||actor.accountId!==principal.accountId||actor.tenantId!==s.tenantId||!Number.isSafeInteger(actor.authVersion)||actor.authVersion<0||actor.authVersion!==principal.authVersion)throw researchError(401,'AUTH_SESSION_EXPIRED','登录状态已变化，请重新核对。');
   const {day,start,end}=calendar(now),binding={schema:1,actor:actor.accountId,authVersion:actor.authVersion,tenant:s.tenantId,studyId,day,timeZone};
   if(cursor){if(['schema','actor','authVersion','tenant','studyId','timeZone'].some(k=>cursor[k]!==binding[k]))invalid();if(cursor.day!==day)throw researchError(409,'DUE_VISIT_DAY_CHANGED','北京时间日期已更新，请重新读取今天的待访视。');}
   const rows=await tx.subjectVisit.findMany({where:{...s,acceptanceFixture:false,status:{in:['planned','due_soon','overdue','in_progress','deviation']},scheduleState:'scheduled',...(cursor?{id:{gt:cursor.afterId}}:{}),OR:[{status:'in_progress'},{windowStart:{lt:end}},{windowStart:null,targetDate:{lt:end}}],subject:{...s,acceptanceFixture:false,deletedAt:null},enrollment:{...s,acceptanceFixture:false,status:{in:['enrolled','grouped','in_progress']}},visitPlan:{...s},protocolVersion:{...s,acceptanceFixture:false,status:{in:activeProtocols}}},select:{...scopeSelect,id:true,acceptanceFixture:true,subjectId:true,enrollmentId:true,visitPlanId:true,protocolVersionId:true,status:true,scheduleState:true,targetDate:true,windowStart:true,windowEnd:true,subject:{select:{...scopeSelect,id:true,subjectId:true,acceptanceFixture:true,deletedAt:true}},enrollment:{select:{...scopeSelect,id:true,subjectId:true,protocolVersionId:true,acceptanceFixture:true}},visitPlan:{select:{...scopeSelect,id:true,protocolVersionId:true,name:true,code:true}},protocolVersion:{select:{...scopeSelect,id:true,acceptanceFixture:true}}},orderBy:{id:'asc'},take:Number(limit)+1});
   // Single-column foreign keys do not prove the fixed parent tuple, including the sentinel.
   for(const row of rows)assertBinding(row,s);
   const items=rows.slice(0,Number(limit)).map(row=>({visitId:row.id,subject:{id:row.subject.id,subjectId:row.subject.subjectId},enrollmentId:row.enrollmentId,protocolVersionId:row.protocolVersionId,visitPlan:{id:row.visitPlan.id,name:row.visitPlan.name,code:row.visitPlan.code},status:row.status,scheduleState:row.scheduleState,targetDate:iso(row.targetDate),windowStart:iso(row.windowStart),windowEnd:iso(row.windowEnd),attention:row.status==='in_progress'?'in_progress':row.status==='overdue'||row.windowEnd&&new Date(row.windowEnd)<start?'overdue':'due'}));
   return{studyId,day,timeZone,items,nextCursor:rows.length>Number(limit)?Buffer.from(JSON.stringify({...binding,afterId:items.at(-1).visitId})).toString('base64url'):null};
  });
 }};
}
