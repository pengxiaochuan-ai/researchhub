import {readFileSync} from 'node:fs';
import {listVisiblePmc} from '../hub-sources/pmc-visible.mjs';
import {listVisible} from '../hub-sources/visible-repository.mjs';

const manifest=JSON.parse(readFileSync(new URL('./publication-assessments.json',import.meta.url),'utf8'));
const scope='CURRENT_HUB_APPROVED_PUBLIC_INDEXED';
export function normalizeDoi(value){
  if(typeof value!=='string')return null;
  const text=value.trim().replace(/^doi\s*:\s*/i,'').replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,'').toLowerCase();
  return /^10\.\d{4,9}\/\S+$/.test(text)?text:null;
}
const normalizedTitle=value=>typeof value==='string'?value.normalize('NFC').replace(/\s+/g,' ').trim().toLowerCase():'';
const pmc=value=>typeof value==='string'&&/^PMC[1-9]\d{0,10}$/i.test(value)?value.toUpperCase():null;
function identity(row){
  const fromId=pmc(/^pmc-(.+)$/.exec(row.id??'')?.[1]),explicit=pmc(row.pmcid);
  return {doi:normalizeDoi(row.doi),pmcids:[...new Set([fromId,explicit].filter(Boolean))],
    invalid:Boolean(row.doi&&!normalizeDoi(row.doi))||Boolean(row.pmcid&&!explicit)||Boolean(fromId&&explicit&&fromId!==explicit)};
}
function matches(row,entry){
  return entry.recordId===row.id&&entry.articleVersion===(row.articleVersion??row.canonicalVersion)&&
    /^[a-f0-9]{64}$/.test(entry.rawSha256??'')&&entry.rawSha256===(row.rawSha256??row.rowSha256)&&
    entry.title===row.title&&normalizeDoi(entry.doi)===normalizeDoi(row.doi)&&
    ['include','exclude','pending'].includes(entry.decision)&&entry.evidence?.length>0&&
    entry.evidence.every(e=>['title','abstract','body'].includes(e.field)&&typeof e.quote==='string'&&e.quote.length>0&&e.quote.length<=500&&typeof row[e.field]==='string'&&row[e.field].includes(e.quote));
}
export function projectPublicationIndex(input,assessments=manifest.entries){
  const rows=input.filter(r=>r.visibility==='public'),ids=rows.map(identity),parent=rows.map((_,i)=>i),aliases=new Map();
  const root=i=>parent[i]===i?i:(parent[i]=root(parent[i]));
  for(let i=0;i<rows.length;i++)for(const key of [...(ids[i].doi?['doi:'+ids[i].doi]:[]),...ids[i].pmcids.map(id=>'pmc:'+id)]){
    if(aliases.has(key))parent[root(i)]=root(aliases.get(key));else aliases.set(key,i);
  }
  const groups=new Map();for(let i=0;i<rows.length;i++){const key=root(i);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);}
  const result={value:0,unit:'篇',scope,basis:'VERSION_PINNED_BROAD_SCOPE_DISTINCT_PAPER',status:'approved_public_indexed',
    reason:'按已确认广义规则核对的公开纳入子集，非全领域总量或疗效评级',ruleVersion:manifest.ruleVersion,
    assessmentMethod:manifest.assessmentMethod,policyAuthority:manifest.policyAuthority,pendingVisibleCount:0,excludedVisibleCount:0,byType:{},included:[]};
  for(const indices of groups.values()){
    const group=indices.map(i=>rows[i]),dois=new Set(indices.map(i=>ids[i].doi).filter(Boolean)),pmcids=new Set(indices.flatMap(i=>ids[i].pmcids));
    const titles=new Set(group.map(r=>normalizedTitle(r.title)).filter(Boolean)),years=new Set(group.map(r=>String(r.year??'').trim()).filter(Boolean));
    const versions=new Map();let duplicateConflict=false;
    for(const r of group){const fingerprint=JSON.stringify([r.articleVersion??r.canonicalVersion,r.rawSha256??r.rowSha256]);if(versions.has(r.id)&&versions.get(r.id)!==fingerprint)duplicateConflict=true;versions.set(r.id,fingerprint);}
    const conflict=indices.some(i=>ids[i].invalid)||(!dois.size&&!pmcids.size)||dois.size>1||pmcids.size>1||titles.size!==1||years.size>1||duplicateConflict;
    const matched=group.flatMap(row=>assessments.filter(entry=>matches(row,entry)).map(entry=>({row,entry})));
    const decisions=new Set(matched.map(x=>x.entry.decision)),types=new Set(matched.filter(x=>x.entry.decision==='include').map(x=>x.entry.type));
    if(conflict||decisions.size!==1||decisions.has('pending')||(decisions.has('include')&&(types.size!==1||!types.values().next().value))){result.pendingVisibleCount++;continue;}
    if(decisions.has('exclude')){result.excludedVisibleCount++;continue;}
    const type=[...types][0],paperKey=dois.size?'doi:'+[...dois][0]:'pmc:'+[...pmcids].sort()[0];
    result.value++;result.byType[type]=(result.byType[type]??0)+1;
    result.included.push({paperKey,type,sources:group.map(row=>({recordId:row.id,sourceUrl:row.sourceUrl,title:row.title,
      articleVersion:row.articleVersion??row.canonicalVersion,sourceHash:row.rawSha256??row.rowSha256,
      reviewVersion:row.reviewVersion,evidence:matched.find(x=>x.row===row&&x.entry.decision==='include')?.entry.evidence??[]}))});
  }
  result.included.sort((a,b)=>a.paperKey.localeCompare(b.paperKey));return result;
}

export async function readPublicationIndex({db,tenantId,hubKey}){
  const [context]=await db.$queryRaw`SELECT current_setting('app.tenant_id',true) AS tenant,current_setting('app.hub_key',true) AS hub`;
  if(context?.tenant!==tenantId||context?.hub!==hubKey||hubKey!==manifest.hubKey)throw Error('HUB_SCOPE_REJECTED');
  const [coverage]=await db.$queryRaw`SELECT count(*)::integer AS total,count(DISTINCT pmcid)::integer AS distinct_ids FROM rh_source.pmc_candidate WHERE tenant_id=${tenantId} AND hub_key=${hubKey} AND campaign_key=${manifest.campaignKey}`;
  const args={db,tenantId,hubKey,principal:null,audience:'public'};
  const workbook=await listVisible({...args,limit:50});
  if(coverage.total>20||coverage.distinct_ids!==coverage.total||workbook.nextCursor||workbook.matchedRecords!==workbook.items.length)
    return {value:null,unit:'篇',scope,basis:'INCOMPLETE_PILOT_INDEX',status:'unverified_scope_or_entity',reason:'论文来源集合已变化，需核验完整口径',ruleVersion:manifest.ruleVersion};
  return projectPublicationIndex([...await listVisiblePmc(args),...workbook.items]);
}
