// Filtering any verified affiliation must not imply that it is the default
// employer or alter an independently verified city coordinate.
export function teamOrganizationText(team){
 const matched=team.matchedAffiliations??[];
 if(matched.length){const primary=matched.filter(x=>x.isPrimaryForDisplay);if(primary.length===1)return '匹配机构：'+primary[0].name;if(matched.length===1)return '匹配机构：'+matched[0].name;return '匹配机构：'+matched.map(x=>x.name).join('、')+'（多机构，查看详情）';}
 if(team.projectionStatus==='CONFLICT')return'机构关系待核对';
 if(team.projectionStatus==='NEEDS_SELECTION')return'多机构任职，查看详情';
 return team.organization?.name??'机构待核验';
}
export function directoryMessage(error){return !error||error.name==='AbortError'?'':error.message||'目录暂时不可用，请重新加载。';}
export function affiliationPeriod(a){
 const month=v=>typeof v==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(v)?v:'';
 const start=month(a?.startMonth),end=month(a?.endMonth);
 return start?(a.current===true?start+' 至今':[start,end].filter(Boolean).join('—')):end?'截至 '+end:'';
}
export function researcherDisplayedAffiliation(person){
 const matched=person.matchedAffiliations??[],candidates=matched.length?matched:person.organization?(person.affiliations??[]).filter(a=>a.id===person.organization.id):[];
 const primary=candidates.filter(a=>a.isPrimaryForDisplay);
 return primary.length===1?primary[0]:primary.length===0&&candidates.length===1?candidates[0]:null;
}
export function researcherTenureText(person){return affiliationPeriod(researcherDisplayedAffiliation(person));}
