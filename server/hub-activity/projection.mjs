import {createHash} from 'node:crypto';
import {activityCategories,activityIdentityKey} from './identity.mjs';

export {activityCategories} from './identity.mjs';
const labels={registration:['临床注册研究','项'],publication:['研究论文','篇'],guidance:['指南与教材','份'],organization:['研究机构','家'],researcher:['研究者','位']};
const beijingDay=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'});
const iso=value=>{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value))return null;
 const time=Date.parse(value);if(!Number.isFinite(time))return null;
 const normalized=new Date(time).toISOString();return normalized.slice(0,19)===value.slice(0,19)?normalized:null;
};
const safeHref=value=>typeof value==='string'&&/^\/pages\/[a-z0-9]+\/(?:[?#][^\s\\]*)?$/.test(value)?value:undefined;
const opaque=value=>createHash('sha256').update(value).digest('hex').slice(0,24);
export function readActivityQuery(query={}){
 if(!query||typeof query!=='object'||Array.isArray(query)||Object.keys(query).some(k=>k!=='limit')||!['4','6'].includes(query.limit??'6'))throw Error('PUBLIC_ACTIVITY_QUERY_INVALID');
 return{limit:Number(query.limit??6)};
}

// Input is the current public source projection, never historical title snapshots.
export function projectPublicActivity({records,categoryStatuses={},now=new Date(),limit=6}){
 if(!Array.isArray(records)||![4,6].includes(limit)||!(now instanceof Date)||!Number.isFinite(now.getTime()))throw Error('PUBLIC_ACTIVITY_INPUT_INVALID');
 const states=Object.fromEntries(activityCategories.map(category=>{
  const input=categoryStatuses[category]??{};
  return[category,{status:input.status==='unavailable'?'unavailable':'ready',coverage:['partial','unknown'].includes(input.coverage)?input.coverage:'complete',dateCoverage:['partial','unknown'].includes(input.dateCoverage)?input.dateCoverage:'complete'}];
 }));
 const incomplete=category=>{states[category].dateCoverage='partial';};
 const entities=new Map();
 for(const record of records){
  if(!record||!activityCategories.includes(record.category))throw Error('PUBLIC_ACTIVITY_CATEGORY_INVALID');
  const category=record.category;
  if(states[category].status!=='ready')continue;
  const key=activityIdentityKey(record);
  if(!key||typeof record.title!=='string'||!record.title.trim()){
   incomplete(category);continue;
  }
  const at=record.timeStatus==='verified'&&Array.isArray(record.proofRefs)&&record.proofRefs.length>0?iso(record.firstPublicAt):null;
  const valid=at&&Date.parse(at)<=now.getTime();
  if(!valid)incomplete(category);
  const prior=entities.get(key);
  if(prior){
   if(prior.record.title!==record.title){prior.conflict=true;incomplete(category);}
   if(valid&&(!prior.at||at<prior.at))prior.at=at;
  }else entities.set(key,{record,at:valid?at:null,conflict:false});
 }
 const groups=new Map();
 for(const {record,at,conflict}of entities.values()){
  if(!at||conflict)continue;
  const {category}=record,day=beijingDay.format(new Date(at));
  const key=JSON.stringify(category==='platform_content'?[category,record.entityKey]:[category,day]);
  if(!groups.has(key))groups.set(key,{category,day,eventAt:at,records:[]});
  const group=groups.get(key);group.records.push(record);if(at>group.eventAt)group.eventAt=at;
 }
 const items=[...groups.entries()].map(([key,group])=>{
  const {category,day,eventAt}=group,content=category==='platform_content';
  const summaries=new Map();for(const record of group.records){const text=typeof record.summary==='string'?record.summary.trim():'';if(text)summaries.set(text,(summaries.get(text)??0)+1);}
  const summary=[...summaries].sort((a,b)=>b[1]-a[1]||(a[0]<b[0]?-1:a[0]>b[0]?1:0)).slice(0,2).map(([text])=>text).join('；');
  return{id:'activity-'+opaque(key),category,kind:content?'content':'aggregate',day,eventAt,
   title:content?group.records[0].title:`新增${labels[category][0]}${group.records.length}${labels[category][1]}`,
   summary,...(content?{...(safeHref(group.records[0].href)?{href:safeHref(group.records[0].href)}:{})}:{count:group.records.length})};
 }).sort((a,b)=>b.eventAt.localeCompare(a.eventAt)||activityCategories.indexOf(a.category)-activityCategories.indexOf(b.category)||a.id.localeCompare(b.id)).slice(0,limit);
 return{scope:'CURRENT_HUB_APPROVED_PUBLIC_INDEXED',timezone:'Asia/Shanghai',calculatedAt:now.toISOString(),
  status:Object.values(states).every(s=>s.status==='ready'&&s.coverage==='complete'&&s.dateCoverage==='complete')?'ready':'partial',categoryStatuses:states,items};
}
