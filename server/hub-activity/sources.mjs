// Trusted adapters only: input fields below must originate in existing PUBLIC readers.
import {listVisibleExternal} from '../hub-sources/external-visible.mjs';
import {listVisiblePmc} from '../hub-sources/pmc-visible.mjs';
import {listVisible} from '../hub-sources/visible-repository.mjs';
import {initialFive,initialDocumentId} from '../hub-sources/initial-five.mjs';
import {projectPublicationIndex} from '../hub/publication-index.mjs';
import {loadDirectoryGraph} from '../directory/repository.mjs';
import {projectDirectory} from '../directory/read-model.mjs';
import {publicAcademicHref} from '../../src/academic-content-route.js';
import {activityCategories,registryActivityIdentity} from './identity.mjs';
const unknown=(category,entityKey,title,summary='')=>({category,entityKey,title,summary,firstPublicAt:null,timeStatus:'historical_undated',proofRefs:[]});
const iso=value=>{if(typeof value!=='string'&&!(value instanceof Date))return null;const d=new Date(value);return Number.isFinite(d.getTime())?d.toISOString():null;};
export function projectActivitySources({external,papers,directory,content,coverage,contentUnavailable=false}){
 const records=[];
 let unknownRegistryIdentity=false;
 for(const row of external){
  if(row.visibility!=='public')continue;
  if(row.documentType==='clinical_registry'){
   // The only currently admitted registry namespace is ChiCTR; unknown namespaces need a contract.
   const entityKey=registryActivityIdentity(row.externalKey);
   if(!entityKey){unknownRegistryIdentity=true;continue;}
   records.push(unknown('registration',entityKey,row.title));
  }else if(['clinical_guideline','research_standard'].includes(row.documentType))records.push(unknown('guidance','external:'+row.documentId,row.title));
 }
 for(const paper of papers.included??[]){const source=paper.sources?.[0];if(source)records.push(unknown('publication',paper.paperKey,source.title));}
 for(const [kind,items] of [['organization',directory.organizations],['researcher',directory.researchers]])for(const item of items)records.push(unknown(kind,item.id,item.name,(item.directions??[]).slice(0,2).join('、')));
 for(const item of content){
  const first=iso(item.firstPublicAt),proof=typeof item.proofRef==='string'&&item.proofRef.length>0?item.proofRef:null;
  records.push({...unknown('platform_content',item.id,item.title,item.summary??''),...(first&&proof?{firstPublicAt:first,timeStatus:'verified',proofRefs:[proof]}:{}),href:publicAcademicHref({id:item.id}),contentType:item.type});
 }
 const categoryStatuses=Object.fromEntries(activityCategories.map(category=>{
  const rows=records.filter(r=>r.category===category),undatedCount=rows.filter(r=>r.timeStatus!=='verified').length;
  const complete=category==='registration'?coverage.external&&!unknownRegistryIdentity:category==='publication'?coverage.publications&&!(papers.pendingVisibleCount>0):category==='guidance'?false:true;
  const reasons=category==='guidance'?['TEXTBOOK_TYPE_UNSUPPORTED']:[];
  if(category==='publication'&&papers.pendingVisibleCount)reasons.push('PUBLICATION_IDENTITY_OR_ADMISSION_PENDING');
  if(category==='publication'&&coverage.publicationDatesUnavailable)return[category,{status:'ready',coverage:'unknown',dateCoverage:'unknown',currentCount:null,undatedCount:null,reasons:['PUBLICATION_FIRST_DATE_UNAVAILABLE']}];
  return[category,category==='platform_content'&&contentUnavailable?{status:'unavailable',coverage:'unknown',dateCoverage:'unknown',currentCount:null,undatedCount:null,reasons:['PUBLIC_CONTENT_READ_FAILED']}:{status:'ready',coverage:complete?'complete':'partial',dateCoverage:undatedCount?'partial':'complete',currentCount:rows.length,undatedCount,reasons}];
 }));
 return{records,categoryStatuses};
}
export async function readAllPublicWorkbook(scope,reader=listVisible){
 const rows=[],seen=new Set();let cursor=null,expected=null;
 do{
  const page=await reader({...scope,cursor,limit:50});
  if(!Array.isArray(page.items)||!Number.isSafeInteger(page.matchedRecords)||page.matchedRecords<0)throw Error('ACTIVITY_SOURCE_PAGINATION_CONFLICT');
  if(expected===null)expected=page.matchedRecords;
  if(expected!==page.matchedRecords)throw Error('ACTIVITY_SOURCE_PAGINATION_CONFLICT');
  for(const row of page.items){if(seen.has(row.id))throw Error('ACTIVITY_SOURCE_PAGINATION_CONFLICT');seen.add(row.id);rows.push(row);}
  const next=page.nextCursor??null;
  if(next!==null&&(next===cursor||!page.items.length||next!==page.items.at(-1).id))throw Error('ACTIVITY_SOURCE_PAGINATION_CONFLICT');
  cursor=next;
 }while(cursor!==null);
 if(rows.length!==expected)throw Error('ACTIVITY_SOURCE_PAGINATION_CONFLICT');
 return rows;
}
export async function readPublicActivitySources({db,tenantId,hubKey,readPublicContent,datedCategories}){
 // F03 raw history is admin-RLS-protected: use the existing explicitly scoped elevated service.
 if(typeof readPublicContent!=='function')throw Error('ACTIVITY_CONTENT_READER_REQUIRED');
 if(hubKey!=='lingshu-xinyu'||!tenantId)throw Error('HUB_SCOPE_REJECTED');
 const [context]=await db.$queryRaw`SELECT current_setting('app.tenant_id',true) AS tenant,current_setting('app.hub_key',true) AS hub`;
 if(context?.tenant!==tenantId||context?.hub!==hubKey)throw Error('HUB_SCOPE_REJECTED');
 const scope={db,tenantId,hubKey,principal:null,audience:'public'};
 const external=await listVisibleExternal({...scope,limit:20});
 const pinnedIds=initialFive.map(item=>initialDocumentId(tenantId,hubKey,item));
 const [externalCoverage]=await db.$queryRaw`SELECT count(*)::integer AS outside FROM rh_source.external_document WHERE tenant_id=${tenantId} AND hub_key=${hubKey} AND NOT(id=ANY(${pinnedIds}::text[]))`;
 // Paper dates come from the event index. With none, hydrating the whole
 // paper corpus cannot produce a dynamic item. Inventory callers still load it.
 const publicationDatesUnavailable=datedCategories!==undefined&&!datedCategories.has('publication');
 let papers={included:[]},publications=false;
 if(!publicationDatesUnavailable){
  const [pmcCoverage]=await db.$queryRaw`SELECT count(*)::integer AS total,count(*) FILTER(WHERE campaign_key='pmc-first-2026-10-31')::integer AS pilot,count(DISTINCT pmcid)::integer AS distinct_ids FROM rh_source.pmc_candidate WHERE tenant_id=${tenantId} AND hub_key=${hubKey}`;
  const workbook=await readAllPublicWorkbook(scope),pmc=await listVisiblePmc(scope);
  papers=projectPublicationIndex([...pmc,...workbook]);
  publications=pmcCoverage.total===pmcCoverage.pilot&&pmcCoverage.pilot<=20&&pmcCoverage.distinct_ids===pmcCoverage.total;
 }
 const graph=await loadDirectoryGraph(db,{tenantId,hubKey,principal:null,audience:'public'});
 const directory={organizations:projectDirectory(graph,'public',{kind:'organization'}),researchers:projectDirectory(graph,'public',{kind:'researcher'})};
 let content=[],contentUnavailable=false;
 // The callback is an independent, already completed F03 snapshot, never SQL on this transaction.
 try{content=await readPublicContent();if(!Array.isArray(content))throw Error('ACTIVITY_CONTENT_PROJECTION_INVALID');}catch{content=[];contentUnavailable=true;}
 return projectActivitySources({external,papers,directory,content,contentUnavailable,coverage:{external:externalCoverage.outside===0,publications,publicationDatesUnavailable}});
}
