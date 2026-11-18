import {affiliationPeriod,researcherDisplayedAffiliation} from './directory-presentation.js';
const roles={lead:'负责人',co_lead:'共同负责人',member:'成员',author:'作者',principal_investigator:'研究负责人',research_team:'研究团队',contributor:'贡献者'};
export function researcherProfile(item){
 const aff=a=>({org:a.name,unit:a.department??'',title:a.positionTitle??'',period:affiliationPeriod(a),current:a.current!==false});
 const current=researcherDisplayedAffiliation(item);
 const works=kind=>item.works.filter(w=>w.kind===kind).map(w=>({title:w.title,role:roles[w.role]??'已核验关联',detailUrl:w.detailUrl,provenance:w.provenance}));
 return{...item,readOnly:true,photo:null,intro:item.summary||'暂无已审核研究简介。',papers:item.metrics.publications?.value??null,trials:item.metrics.clinicalTrials?.value??null,guideCount:null,partnerCount:null,
  badges:item.relevance.label?[item.relevance.label]:[],directions:item.directions.map(title=>({title,text:'',kind:'明确'})),dimensions:[],reasons:item.relevance.reason?[item.relevance.reason]:[],
  works:works('publication'),trialRows:works('clinical_registry'),guides:works('guidance'),partners:item.collaborations.filter(c=>c.entityKind==='organization').map(c=>c.name),coResearchers:item.collaborations.filter(c=>c.entityKind==='researcher').map(c=>({name:c.name,role:c.kind})),projectNames:[],
  affiliations:item.affiliations.map(aff),current:current?aff(current):{org:item.projectionStatus==='CONFLICT'?'机构关系待核对':item.projectionStatus==='NEEDS_SELECTION'?'多机构任职，查看下方资料':'机构待核验',unit:'',title:item.rank??'',period:''},history:(item.affiliationHistory??[]).map(aff),education:[],identifiers:[],
  teams:item.teams.map(t=>({...t,role:roles[t.role]??'成员',core:t.id===item.primaryTeam?.id})),
 };
}
