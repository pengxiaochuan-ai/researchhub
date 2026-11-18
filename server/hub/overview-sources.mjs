import {overviewVisible} from '../hub-sources/visible-repository.mjs';
import {listVisiblePmc} from '../hub-sources/pmc-visible.mjs';

// The preview is a source-record catalog, not the curated paper KPI. Keep
// workbook entries intact; new PMC entries need only bibliographic metadata.
export function projectOverviewSources(workbook,pmc){
  const summaries=pmc.map(({id,title,authors,journal,year,doi,sourceUrl,sourceName,canonicalVersion,reviewVersion,visibility})=>
    ({id,title,authors,journal,year,doi,sourceUrl,sourceName,canonicalVersion,reviewVersion,visibility}));
  return {items:[...summaries,...workbook.items].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0).slice(0,6),
    recordCount:pmc.length+workbook.recordCount};
}

export async function readOverviewSources({db,tenantId,hubKey}){
  const args={db,tenantId,hubKey};
  const workbook=await overviewVisible({...args,limit:6});
  const pmc=await listVisiblePmc({...args,principal:null,audience:'public'});
  return projectOverviewSources(workbook,pmc);
}
