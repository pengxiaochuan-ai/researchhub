export const HUB_KEY='lingshu-xinyu';
export const fail=(status,code,message)=>{throw Object.assign(Error(message),{status,code});};
export function only(value,keys){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k)))fail(400,'CONTENT_INPUT_INVALID','请核对填写内容。');}
const text=(v,max,required=false)=>{if(v==null&&!required)return '';if(typeof v!=='string'||[...v.trim()].length>max||required&&!v.trim())fail(400,'CONTENT_INPUT_INVALID','请核对必填项和文字长度。');return v.trim();};
export function safeUrl(value){
 const raw=text(value,2048,true);let u;try{u=new URL(raw);}catch{fail(400,'CONTENT_URL_INVALID','请填写完整HTTPS原站链接。');}
 let fragment;try{fragment=decodeURIComponent(u.hash);}catch{fail(400,'CONTENT_URL_INVALID','链接格式无效。');}
 if(u.protocol!=='https:'||u.username||u.password||/(?:token|password|secret|signature|authorization|api.?key)\s*=/i.test(fragment)||/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|\[)/i.test(u.hostname)||[...u.searchParams.keys()].some(k=>/token|password|secret|signature|authorization|api.?key|^key$|^code$/i.test(k)))fail(400,'CONTENT_URL_INVALID','链接不能包含访问口令或私有凭证。');return u.href;
}
function time(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value.slice(0,10)+'T00:00:00Z').toISOString().slice(0,10)!==value.slice(0,10)||Number(value.slice(11,13))>23||Number(value.slice(14,16))>59||Number(value.slice(17,19))>59)fail(400,'CONTENT_TIME_INVALID','请填写有效的活动开始与结束时间。');return new Date(value).toISOString();}
export function draftInput(value){
 only(value,['title','type','body','summary','source','sourceUrl','rights','audience','resources','event']);
 const type=value.type??'news',audience=value.audience??'members';
 if(!['news','progress','notice','event'].includes(type)||!['members','public'].includes(audience))fail(400,'CONTENT_INPUT_INVALID','请选择有效类型和可见范围。');
 const body=text(value.body,20000),sourceUrl=value.sourceUrl?safeUrl(value.sourceUrl):'';
 if(value.resources!==undefined&&(!Array.isArray(value.resources)||value.resources.length>20))fail(400,'CONTENT_INPUT_INVALID','资料最多20项。');
 const resources=(value.resources??[]).map((r,index)=>{only(r,['label','url','audience','rights']);const scope=r.audience??audience;if(!['public','members'].includes(scope))fail(400,'CONTENT_INPUT_INVALID','资料可见范围无效。');return{key:String(index+1),label:text(r.label,120,true),url:safeUrl(r.url),audience:scope,rights:text(r.rights,1000)};});
 let event=null;
 if(value.event!=null){only(value.event,['startAt','endAt','allDay','speaker','organizer','mode','place','cancelled','cancellationReason']);const e=value.event;
  if(e.allDay!==undefined&&typeof e.allDay!=='boolean'||e.cancelled!==undefined&&typeof e.cancelled!=='boolean')fail(400,'CONTENT_INPUT_INVALID','活动标记无效。');
  const startAt=e.startAt?time(e.startAt):'',endAt=e.endAt?time(e.endAt):'';if(startAt&&endAt&&endAt<=startAt)fail(400,'CONTENT_TIME_INVALID','结束时间必须晚于开始时间。');
  if(e.mode!==undefined&&!['online','offline','hybrid',''].includes(e.mode))fail(400,'CONTENT_INPUT_INVALID','举办方式无效。');
  event={startAt,endAt,timezone:'Asia/Shanghai',allDay:e.allDay??false,speaker:text(e.speaker,500),organizer:text(e.organizer,500),mode:e.mode??'',place:text(e.place,1000),cancelled:e.cancelled??false,cancellationReason:text(e.cancellationReason,1000)};
 }
 return{title:text(value.title,120,true),type,body,summary:text(value.summary,500)||[...body.split(/\n\s*\n/)[0].replace(/\s+/g,' ')].slice(0,160).join(''),source:text(value.source,1000),sourceUrl,rights:text(value.rights,1000),audience,resources,event};
}
export function validatePublication(d){
 if(!d.body||!d.source||!d.rights||d.resources.some(r=>!r.rights))fail(400,'CONTENT_PUBLICATION_INCOMPLETE','发布前请补正文、来源及内容和资料的使用依据。');
 if(d.type==='event'&&(!d.event?.startAt||!d.event?.endAt||!d.event.mode||!d.event.place||!d.event.speaker&&!d.event.organizer||d.event.cancelled&&!d.event.cancellationReason))fail(400,'CONTENT_EVENT_INCOMPLETE','请补活动时间、讲者或组织、方式、地点或参与说明；取消需写说明。');
}
export function eventPhase(e,now=Date.now()){if(!e)return null;if(e.cancelled)return'cancelled';return now<Date.parse(e.startAt)?'upcoming':now<Date.parse(e.endAt)?'ongoing':'past';}
export function publicView(item,member=false,now=Date.now()){
 const {id,title,type,body,summary,source,sourceUrl,audience,publishedAt,updatedAt,event}=item;
 return{id,title,type,body,summary,source,sourceUrl,audience,publishedAt,updatedAt,event:type==='event'?{...event,phase:eventPhase(event,now)}:null,resources:(item.resources??[]).filter(r=>member||r.audience==='public').map(({key,label,audience})=>({key,label,audience}))};
}
export function contentCard(item){const {id,title,type,summary,audience,publishedAt,updatedAt,event}=item;return{id,title,type,summary,audience,publishedAt,updatedAt,event};}
