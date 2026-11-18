import {formalUrl} from './formal-preparation-session.js';
import {protocolReviewDetailHref} from './governance-protocol-route.js';
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(v);
const invalid=()=>{throw Error('方案待审列表暂时无法核对，请重新读取。');};
export function parseReviewPage(result,previousCursor){
 if(!result||!Array.isArray(result.items)||!(result.nextCursor===null||typeof result.nextCursor==='string'&&/^[A-Za-z0-9_-]{1,8192}$/.test(result.nextCursor))||result.nextCursor&&result.nextCursor===previousCursor)invalid();
 const seen=new Set(),items=result.items.map(item=>{const p=item?.protocol;if(!id(item?.studyId)||typeof item.studyTitle!=='string'||!id(p?.id)||typeof p.title!=='string'||!Number.isSafeInteger(p.versionNumber)||p.versionNumber<1||p.status!=='pending_review'||p.updatedAt!=null&&(typeof p.updatedAt!=='string'||!Number.isFinite(Date.parse(p.updatedAt))))invalid();const key=item.studyId+':'+p.id;if(seen.has(key))invalid();seen.add(key);return{studyId:item.studyId,studyTitle:item.studyTitle,protocol:p,href:formalUrl('s07',item.studyId,p.id)};});return{items,nextCursor:result.nextCursor};
}
export function parseDecisionPage(result,previousCursor){
 const fail=()=>{throw Error('审核记录暂时无法核对，请重新读取。');};
 if(!result||!Array.isArray(result.items)||!(result.nextCursor===null||typeof result.nextCursor==='string'&&/^[A-Za-z0-9_-]{1,8192}$/.test(result.nextCursor))||result.nextCursor&&result.nextCursor===previousCursor)fail();
 const seen=new Set(),items=result.items.map(x=>{
  const p=x?.protocol,d=x?.decision;
  if(!id(x?.studyId)||typeof x.studyTitle!=='string'||!id(p?.id)||typeof p.title!=='string'||!Number.isSafeInteger(p.versionNumber)||p.versionNumber<1||!['draft','pending_review','approved','executing','superseded','archived'].includes(p.status)||!id(d?.id)||!['returned','approved','activated'].includes(d.kind)||typeof d.createdAt!=='string'||!Number.isFinite(Date.parse(d.createdAt))||!(d.actorName===null||typeof d.actorName==='string')||!(d.reason===null||typeof d.reason==='string'))fail();
  if(seen.has(d.id))fail();seen.add(d.id);return{...x,href:protocolReviewDetailHref(x.studyId,p.id,'processed')};
 });return{items,nextCursor:result.nextCursor};
}
// Rebuild the opened range under current authorization; never merge prior rows.
export async function readProtocolReviewRange(request,tab,desired=20){
 if(!['pending','processed'].includes(tab)||!Number.isSafeInteger(desired)||desired<1)throw Error('列表条件无效，请重新读取。');
 const endpoint=tab==='pending'?'protocol-reviews':'protocol-decisions',parse=tab==='pending'?parseReviewPage:parseDecisionPage,items=[],keys=new Set(),cursors=new Set(),signal=AbortSignal.timeout(20000);let cursor=null;
 do{
  signal.throwIfAborted();const q=new URLSearchParams({limit:String(Math.min(100,desired-items.length)),...(cursor?{cursor}:{})}),page=parse(await request('/research-studies/'+endpoint+'?'+q,{signal}),cursor);
  signal.throwIfAborted();
  for(const item of page.items){const key=tab==='pending'?item.studyId+':'+item.protocol.id:item.decision.id;if(keys.has(key))throw Error('列表已有变化，请重新读取。');keys.add(key);items.push(item);}
  cursor=page.nextCursor;if(cursor){if(cursors.has(cursor))throw Error('列表已有变化，请重新读取。');cursors.add(cursor);}
 }while(cursor&&items.length<desired);
 return{items,nextCursor:cursor};
}
