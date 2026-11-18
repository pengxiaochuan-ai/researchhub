import {listVisibleExternal} from '../hub-sources/external-visible.mjs';
import {loadDirectoryGraph} from '../directory/repository.mjs';
import {projectDirectory} from '../directory/read-model.mjs';
import {readPublicationIndex} from './publication-index.mjs';

const scope='CURRENT_HUB_APPROVED_PUBLIC_INDEXED';
const known=(value,unit,basis)=>({value,unit,scope,basis,status:'approved_public_indexed',reason:'当前Hub已审核公开收录，非全领域总量'});
export function projectOverviewMetrics(external,graph){
  const count=types=>new Set(external.filter(row=>types.includes(row.documentType)).map(row=>row.documentType+':'+row.externalKey)).size;
  const profiles=kind=>new Set(projectDirectory(graph,'public',{kind}).map(row=>row.id)).size;
  return {
    registrations:known(count(['clinical_registry']),'项','INITIAL_APPROVED_SOURCES_V1_DISTINCT_REGISTRATION_KEY'),
    publications:{value:null,unit:'篇',scope,basis:'UNVERIFIED_PUBLICATION_SCOPE',status:'unverified_scope_or_entity',reason:'论文去重与领域纳入待核验'},
    guides:known(count(['clinical_guideline','research_standard']),'份','INITIAL_APPROVED_SOURCES_V1_DISTINCT_TYPE_KEY'),
    institutions:known(profiles('organization'),'家','CURRENT_PUBLIC_DIRECTORY_DISTINCT_ORGANIZATION_ID'),
    researchers:known(profiles('researcher'),'位','CURRENT_PUBLIC_DIRECTORY_DISTINCT_RESEARCHER_ID'),
  };
}

export async function readOverviewMetrics({db,tenantId,hubKey}){
  const [context]=await db.$queryRaw`SELECT current_setting('app.tenant_id',true) AS tenant,current_setting('app.hub_key',true) AS hub`;
  if(context?.tenant!==tenantId||context?.hub!==hubKey)throw new Error('HUB_SCOPE_REJECTED');
  // Match the directory reader/writer tenant lock; never use the caller's
  // member projection to compute a public aggregate.
  await db.$executeRaw`SELECT pg_advisory_xact_lock_shared(hashtextextended(${'wp01:tenant:'+tenantId},0))`;
  const [active]=await db.$queryRaw`SELECT h.hub_key FROM rh_hub.hub h JOIN public.tenant t ON t.id=h.tenant_id WHERE h.tenant_id=${tenantId} AND h.hub_key=${hubKey} AND h.status='active' AND t.status='active'`;
  if(!active)return null;
  if(hubKey!=='lingshu-xinyu')return Object.fromEntries(['registrations','publications','guides','institutions','researchers'].map(key=>[key,{value:null,status:'unverified_scope_or_entity',reason:'此领域统计口径尚未核验'}]));
  const publicScope={db,tenantId,hubKey,principal:null,audience:'public'};
  // The reused source projection is deliberately the complete five-source
  // pilot whitelist, NOT a paginated list of an unbounded corpus.
  const external=await listVisibleExternal({...publicScope,limit:20});
  const graph=await loadDirectoryGraph(db,publicScope);
  const metrics=projectOverviewMetrics(external,graph);
  metrics.publications=await readPublicationIndex({db,tenantId,hubKey});
  return metrics;
}
