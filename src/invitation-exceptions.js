import{validInvitationId}from'./invitation-location.js';
const validScope=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(v);
const fail=()=>{throw Error('邀请记录已变化或暂时无法核对，请刷新重试。');};
const cancelled=signal=>signal?.throwIfAborted();
const labels={failed:'投递失败',unknown:'投递结果未确认',expired:'已过期'};
const reasons={failed:'邀请邮件投递失败。',unknown:'邀请邮件投递结果未确认，请先核对。',expired:'邀请已过期，可按需重发或撤销。'};
function page(value){
 if(!Array.isArray(value?.items)||value.items.length>50||!(value.nextCursor===null||typeof value.nextCursor==='string'&&/^[A-Za-z0-9_-]{1,512}$/.test(value.nextCursor)))fail();
 for(const x of value.items)if(!validInvitationId(x?.id)||typeof x.email!=='string'||x.email.length>254||!['pending','captured','failed','unknown','accepted','revoked','expired'].includes(x.status)||!Number.isInteger(x.version)||x.version<1||typeof x.createdAt!=='string'||!Number.isFinite(Date.parse(x.createdAt))||typeof x.expiresAt!=='string'||!Number.isFinite(Date.parse(x.expiresAt)))fail();
 return value;
}
export async function readInvitationTarget(list,targetId,{signal}={}){
 if(targetId!==undefined&&!validInvitationId(targetId))fail();
 const items=[],ids=new Set(),cursors=new Set();let cursor=null,found=false;
 do{
  cancelled(signal);const value=page(await list({limit:'50',...(cursor?{cursor}:{})},{signal}));cancelled(signal);
  for(const x of value.items){if(ids.has(x.id))fail();ids.add(x.id);items.push(x);if(x.id===targetId)found=true;}
  cursor=value.nextCursor;if(cursor){if(cursors.has(cursor))fail();cursors.add(cursor);}
 }while(cursor&&!found);
 return{items,nextCursor:cursor,found};
}
export async function loadInvitationExceptions({studies,list,signal}){
 cancelled(signal);const value=await studies({signal});cancelled(signal);
 if(!Array.isArray(value?.items))fail();const scopes=new Set();
 for(const s of value.items){
  if(!validScope(s?.studyGroupId)||!validScope(s.researchProjectId)||typeof s.name!=='string')fail();const key=s.studyGroupId+':'+s.researchProjectId;if(scopes.has(key))fail();scopes.add(key);
 }
 const stop=new AbortController(),readSignal=signal?AbortSignal.any([signal,stop.signal]):stop.signal,rows=new Array(value.items.length);let next=0,failure;
 async function worker(){
  while(!failure){
   try{
    cancelled(readSignal);const index=next++;if(index>=value.items.length)return;
    const s=value.items[index],key=s.studyGroupId+':'+s.researchProjectId;
    const result=await readInvitationTarget((q,options)=>list({groupId:s.studyGroupId,projectId:s.researchProjectId},q,options),undefined,{signal:readSignal});
    rows[index]=result.items.filter(x=>Object.hasOwn(labels,x.status)).map(x=>({id:key+':'+x.id,title:'成员邀请：'+x.email,status:x.status,stateLabel:labels[x.status],kind:'invitations',module:'access',eventKey:'invitations:'+key+':'+x.id,disposition:'attention',reason:reasons[x.status],scopeLabel:s.name,updatedAt:x.createdAt,timeLabel:'邀请时间',actionLabel:'查看邀请'}));
   }catch(error){failure??=error;stop.abort();return;}
  }
 }
 await Promise.all(Array.from({length:Math.min(3,value.items.length)},worker));
 if(failure)throw failure;cancelled(signal);return rows.flat();
}
