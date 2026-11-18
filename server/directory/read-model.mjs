import {directoryHash,directoryError} from './contract.mjs';
import {regionAnchor,mapReference} from './map-regions.mjs';
import {cityReference,assertCityReferenceReady} from '../reference/city-points.mjs';
function current(graph){const map=new Map();for(const h of graph.heads){const key=h.entityId+'\0'+h.assertionKey,prior=map.get(key);if(!prior||h.revision>prior.revision)map.set(key,h);}return [...map.values()];}
const activeDecision=(h,audience)=>h.decision?.decision==='approve'&&['public',...(audience==='tenant'?['tenant']:[])].includes(h.decision.audience)&&(!h.decision.expiresAt||Date.parse(h.decision.expiresAt)>Date.now());
const ready=(h,audience)=>activeDecision(h,audience)&&h.sources?.length>0&&h.sources.every(s=>s.available);
const decisionDigest=h=>({id:h.id,revision:h.revision,hash:h.hash,decision:h.decision,active:activeDecision(h,'tenant'),sources:h.sources?.map(s=>s.fingerprint)??[]});
function context(graph,audience){const entities=new Map(graph.entities.filter(e=>!e.archivedAt).map(e=>[e.id,e])),heads=current(graph),profiles=new Map(heads.filter(h=>h.kind==='profile'&&entities.has(h.entityId)&&ready(h,audience)).map(h=>[h.entityId,h]));const visible=heads.filter(h=>profiles.has(h.entityId)&&ready(h,audience)&&(!h.relatedEntityId||profiles.has(h.relatedEntityId)));return{entities,heads,profiles,visible};}
function metricRelations(graph,entityId,metric){return current(graph).filter(h=>metric==='members'?h.kind==='team_member'&&h.relatedEntityId===entityId:metric==='teams'?h.kind==='team_member'&&h.entityId===entityId:h.kind==='work'&&h.entityId===entityId);}
export function relationSetHash(graph,entityId,metric,audience){
 const rows=metricRelations(graph,entityId,metric),ids=new Set([entityId,...rows.flatMap(h=>[h.entityId,h.relatedEntityId]).filter(Boolean)]),profiles=current(graph).filter(h=>h.kind==='profile'&&ids.has(h.entityId));
 return directoryHash({entityId,metric,audience,entities:graph.entities.filter(e=>ids.has(e.id)).sort((a,b)=>a.id.localeCompare(b.id)),relations:rows.sort((a,b)=>a.id.localeCompare(b.id)).map(decisionDigest),profiles:profiles.sort((a,b)=>a.id.localeCompare(b.id)).map(decisionDigest)});
}
function single(rows,primary){const mains=rows.filter(primary);if(mains.length>1)return{value:null,status:'CONFLICT'};if(mains.length===1)return{value:mains[0],status:'RESOLVED'};return rows.length===1?{value:rows[0],status:'RESOLVED'}:{value:null,status:rows.length?'NEEDS_SELECTION':'RESOLVED'};}
function proof(h){return{assertionId:h.id,revision:h.revision,assertionHash:h.hash,decisionVersion:h.decision.version,reviewedAt:h.decision.createdAt,audience:h.decision.audience,sources:h.sources.map(({available,fingerprint,...safe})=>safe)};}
export function projectDirectory(graph,audience,{kind='team'}={}){
 const c=context(graph,audience),output=[];
 for(const e of c.entities.values()){
  const hp=c.profiles.get(e.id);if(e.kind!==kind||!hp)continue;const p=hp.payload;
  const affiliations=c.visible.filter(h=>h.kind==='affiliation'&&h.entityId===e.id&&h.payload.current).map(h=>{const op=c.profiles.get(h.relatedEntityId).payload;return{id:h.relatedEntityId,name:op.name,city:h.payload.city??op.city??null,organizationType:h.payload.organizationType??op.organizationType??null,isPrimaryForDisplay:h.payload.isPrimaryForDisplay,department:h.payload.department??null,positionTitle:h.payload.positionTitle??null,startMonth:h.payload.startMonth??null,endMonth:h.payload.endMonth??null,current:h.payload.current,assertion:h};});
  const selected=single(affiliations,r=>r.isPrimaryForDisplay),organization=selected.value?{id:selected.value.id,name:selected.value.name,organizationType:selected.value.organizationType}:null;
  const geo=selected.status==='CONFLICT'?null:p.city??selected.value?.city??null;
  const memberHeads=c.visible.filter(h=>h.kind==='team_member'&&h.relatedEntityId===e.id&&h.payload.current),leads=memberHeads.filter(h=>['lead','co_lead'].includes(h.payload.memberRole)).map(h=>({id:h.entityId,name:c.profiles.get(h.entityId).payload.name,role:h.payload.memberRole})).sort((a,b)=>a.id.localeCompare(b.id));
  const works=c.visible.filter(h=>h.kind==='work'&&h.entityId===e.id).flatMap(h=>{const s=h.sources.find(s=>s.canonicalKey===h.payload.canonicalKey&&s.kind===h.payload.sourceKind&&s.sourceId===h.payload.sourceId&&s.sourceHash===h.payload.sourceHash);return s?[{id:h.id,title:s.title,canonicalKey:s.canonicalKey,kind:s.workType,detailUrl:s.detailUrl,role:h.payload.role,provenance:proof(h)}]:[];});
  const uniqueWorks=[...new Map(works.map(w=>[w.canonicalKey,w])).values()];
  const metrics={};for(const metric of ['publications','clinicalTrials','members','teams']){const coverage=c.visible.find(h=>h.kind==='coverage'&&h.entityId===e.id&&h.payload.metric===metric&&h.payload.audienceScope===audience),valid=coverage?.payload.status==='VERIFIED_INDEXED_SET'&&coverage.payload.relationSetHash===relationSetHash(graph,e.id,metric,audience);let value=null;if(valid)value=metric==='members'?new Set(memberHeads.map(h=>h.entityId)).size:metric==='teams'?new Set(c.visible.filter(h=>h.kind==='team_member'&&h.entityId===e.id&&h.payload.current).map(h=>h.relatedEntityId)).size:uniqueWorks.filter(w=>w.kind===(metric==='publications'?'publication':'clinical_registry')).length;metrics[metric]={value,coverage:valid?'INDEXED_CURRENT':'UNVERIFIED',scope:'CURRENT_HUB_REVIEWED_RELATIONS'};}
  const match=p.hubMatch,confirmed=match?.status==='CONFIRMED';
  output.push({id:e.id,kind:e.kind,name:p.name,aliases:p.aliases??[],organization,affiliations:affiliations.map(({assertion,...safe})=>safe),matchedAffiliations:[],city:geo?.name??null,region:geo?.region??null,geo,lead:leads.length===1?leads[0]:null,leads,summary:p.summary??'',directions:p.directions??[],teamType:p.teamType??null,rank:p.rank??null,researchRole:p.researchRole??null,relevance:{label:confirmed?(match.tier==='HIGH_RELEVANCE'?'高相关':'相关'):null,tier:confirmed?match.tier:null,reason:confirmed?match.reason:null},photo:null,metrics,representativeWorks:uniqueWorks.slice(0,2),works:uniqueWorks,projectionStatus:selected.status,detailUrl:'/pages/t02/?team='+encodeURIComponent(e.id),provenance:[hp,...affiliations.map(a=>a.assertion),...memberHeads].map(proof)});
 }
 if(kind==='researcher')for(const item of output){const teams=c.visible.filter(h=>h.kind==='team_member'&&h.entityId===item.id&&h.payload.current).map(h=>({id:h.relatedEntityId,name:c.profiles.get(h.relatedEntityId).payload.name,role:h.payload.memberRole,isPrimary:h.payload.isPrimary,provenance:proof(h)})),selected=single(teams.filter(r=>r.isPrimary),()=>true);Object.assign(item,{currentAffiliation:item.organization,teams,primaryTeam:selected.value,teamProjectionStatus:selected.status,detailUrl:'/pages/r02/?id='+encodeURIComponent(item.id)});}
 return output;
}
const dimensions=['direction','region','organizationType','teamType'];
const researcherDimensions=['direction','region','organizationId','researchRole','rank'];
const dimensionKeys=options=>options?.kind==='researcher'?researcherDimensions:dimensions;
function values(item,key){if(key==='direction')return item.directions;if(key==='region')return item.region?[item.region]:[];if(key==='organizationId')return [...new Set(item.affiliations.map(x=>x.id))];if(['rank','researchRole'].includes(key))return item[key]?[item[key]]:[];if(key==='organizationType')return [...new Set(item.affiliations.map(x=>x.organizationType).filter(Boolean))];return item.teamType?[item.teamType]:[];}
function validateFilters(items,q,options){for(const k of dimensionKeys(options))if(q[k]&&!items.some(i=>values(i,k).includes(q[k])))throw directoryError('DIRECTORY_INVALID_FILTER',400,'该筛选值当前不可用，请清除条件后重新核对。');}
export function filterDirectory(items,q,except=null,options){return items.filter(i=>{if(q.q&&!([i.name,...i.aliases,i.summary,...i.directions,...i.affiliations.map(a=>a.name),...i.leads.map(l=>l.name)].join(' ').toLocaleLowerCase().includes(q.q.toLocaleLowerCase())))return false;return dimensionKeys(options).every(k=>k===except||!q[k]||values(i,k).includes(q[k]));});}
export function listDirectory(items,q,dataRevision,options){validateFilters(items,q,options);const rows=filterDirectory(items,q,null,options).sort((a,b)=>{if(q.sort==='relevance'){const rank=i=>i.relevance.tier==='HIGH_RELEVANCE'?0:i.relevance.tier==='RELATED'?1:2;return rank(a)-rank(b)||a.id.localeCompare(b.id);}const av=a.metrics[q.sort]?.value,bv=b.metrics[q.sort]?.value;return(av===null?1:0)-(bv===null?1:0)||(bv??0)-(av??0)||a.id.localeCompare(b.id);});const totalPages=Math.ceil(rows.length/10);if(q.page>1&&q.page>totalPages)throw Object.assign(directoryError('DIRECTORY_RESULT_CHANGED',409,'结果已变化，请保留条件并回到第1页重新核对。'),{totalPages});return{items:rows.slice((q.page-1)*10,q.page*10).map(i=>({...i,matchedAffiliations:q.organizationId?i.affiliations.filter(a=>a.id===q.organizationId):q.organizationType?i.affiliations.filter(a=>a.organizationType===q.organizationType):[]})),pagination:{page:q.page,pageSize:10,totalItems:rows.length,totalPages,pageLimit:10000},appliedFilters:Object.fromEntries(Object.entries(q).filter(([k])=>!['page','pageSize'].includes(k)).map(([k,v])=>[k,String(v)])),dataRevision};}
export function facetDirectory(items,q,options){validateFilters(items,q,options);return Object.fromEntries(dimensionKeys(options).map(key=>{const counts=new Map();for(const i of filterDirectory(items,q,key,options))for(const v of new Set(values(i,key)))counts.set(v,(counts.get(v)??0)+1);return[key,[...counts].sort(([a],[b])=>a.localeCompare(b,'zh')).map(([value,count])=>({value,label:key==='organizationId'?items.flatMap(i=>i.affiliations).find(a=>a.id===value)?.name??value:value,count}))];}));}
export function mapDirectory(items,q,dataRevision){
 assertCityReferenceReady();validateFilters(items,q);const rows=filterDirectory(items,q),groups=new Map(),regionGroups=new Map(),referenceGroups=new Map();
 for(const i of rows){
  const city=cityReference(i.geo);
  if(city){const prior=referenceGroups.get(city.cityCode);referenceGroups.set(city.cityCode,{...city,teamCount:(prior?.teamCount??0)+1});continue;}
  const anchor=regionAnchor(i.geo);
  if(anchor){const prior=regionGroups.get(anchor.regionCode);regionGroups.set(anchor.regionCode,{...anchor,teamCount:(prior?.teamCount??0)+1});continue;}
  if(!i.city||!i.geo||!Number.isFinite(i.geo.longitude)||!Number.isFinite(i.geo.latitude))continue;
  const arr=groups.get(i.city)??[];arr.push(i);groups.set(i.city,arr);
 }
 if(groups.size+referenceGroups.size>100)throw directoryError('DIRECTORY_MAP_TOO_LARGE',400,'地图城市过多，请收窄筛选范围。');
 // Different location bases remain separate, even for the same city: a city's
 // reference teams must never be placed at another team's source address.
 const cities=[...referenceGroups.values()];for(const[city,items]of groups){const unique=new Set(items.map(i=>[i.geo.longitude,i.geo.latitude,i.geo.coordinateKind].join(':')));if(unique.size!==1)continue;const geo=items[0].geo;cities.push({city,longitude:geo.longitude,latitude:geo.latitude,coordinateKind:geo.coordinateKind,teamCount:items.length});}
 const regions=[...regionGroups.values()].sort((a,b)=>a.regionCode.localeCompare(b.regionCode)),regionMappedTeamCount=regions.reduce((sum,r)=>sum+r.teamCount,0),mappedTeamCount=cities.reduce((sum,c)=>sum+c.teamCount,0)+regionMappedTeamCount;
 return{matchedTeamCount:rows.length,mappedTeamCount,unmappedTeamCount:rows.length-mappedTeamCount,cities:cities.sort((a,b)=>a.city.localeCompare(b.city,'zh')),regions,regionMappedTeamCount,mapReference,dataRevision};
}
export const directoryRevision=graph=>directoryHash({entities:graph.entities,heads:current(graph).map(decisionDigest).sort((a,b)=>a.id.localeCompare(b.id))});
export const visibleDirectoryFacts=(graph,audience)=>context(graph,audience).visible;
