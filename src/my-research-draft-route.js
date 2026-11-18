import {makeDesignWorkspaceUrl} from './research-design-session.js';
import {makeAssetApplicabilityUrl} from './asset-applicability-session.js';
import {makeCrfMethodAssetUrl,makeCrfMethodReportUrl} from './crf-method-assets-session.js';
import {makeSyntheticEdcUrl} from './synthetic-edc-session.js';
const valid=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(v);

// Navigation hints only: the destination always revalidates the object and sources.
export function myResearchDraftLink(draft){
 const scope={studyGroupId:draft.studyGroupId,researchProjectId:draft.researchProjectId};
 if(!valid(draft.id)||!valid(scope.studyGroupId)||!valid(scope.researchProjectId))throw Error('草稿入口无效');
 if(draft.canOpenWorkspace===false)return null;
 const w=draft.workspace;
 if(!w)return draft.canOpenPlanFlow?{href:makeDesignWorkspaceUrl('q01',scope,draft.id),label:'继续草稿 →'}:null;
 if(['trial-report','edc-report','method-report'].includes(w.kind)&&(!Number.isSafeInteger(draft.version)||draft.version<1||draft.version>30))throw Error('报告版本无效');
 switch(w.kind){
 case 'plan':return{href:makeDesignWorkspaceUrl('q01',scope,draft.id),label:'继续方案草稿 →'};
 case 'applicability':return{href:makeAssetApplicabilityUrl(scope,draft.id),label:'继续适用性核对 →'};
 case 'method-asset':return{href:makeCrfMethodAssetUrl('a02',scope,draft.id),label:'继续方法资产候选 →'};
 case 'asset':return{href:'/pages/a02/?'+new URLSearchParams({...scope,assetDraftId:draft.id}),label:'继续资产候选 →'};
 case 'collection':return{href:makeSyntheticEdcUrl('s04',scope,w.planId,draft.id),label:'继续合成记录包 →'};
 case 'edc-report':return{href:makeSyntheticEdcUrl('s05',scope,w.planId,w.collectionId),label:'进入报告所在记录包 →'};
 case 'method-report':return{href:makeCrfMethodReportUrl(scope,w.planId,w.collectionId,w.runId,draft.id,draft.version),label:'查看方法报告草稿 →'};
 case 'trial-report':if(valid(w.runId))return{href:makeDesignWorkspaceUrl('q01',scope,w.planId)+'&'+new URLSearchParams({syntheticRunId:w.runId,syntheticReportVersion:String(draft.version)}),label:'进入报告关联方案 →'};break;
 }
 throw Error('草稿入口无效');
}
