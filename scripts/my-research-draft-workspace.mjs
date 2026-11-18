import {myResearchDraftLink} from '../src/my-research-draft-route.js';
const families={
 'rh-asset-applicability-20261026':['research_report','rh-asset-applicability.v1','applicability'],
 'rh-crf-method-asset-20261026':['research_report','rh-crf-method-asset.v1','method-asset'],
 'rh-asset-20261022':['research_report','rh-synthetic-asset.v1','asset'],
 'rh-edc-20261023':['research_report','rh-synthetic-edc.v1','collection'],
 'rh-edc-report-20261023':['data_quality_report','rh-synthetic-edc-report.v1','edc-report'],
 'rh-crf-method-report-20261025':['data_quality_report','rh-synthetic-crf-method-report.v1','method-report'],
 'rh-report-20261022':['data_quality_report','rh-synthetic-report.v1','trial-report'],
};
export function draftWorkspace(draft,blocks,accountId,allowed){
 if(!allowed||draft.ownerAccountId!==accountId||draft.createdBy!==accountId||!Array.isArray(blocks)||blocks.length!==1)return null;
 const b=blocks[0],parts=draft.idempotencyKey?.split(':')??[],family=families[parts[0]];
 if(!family||parts[1]!==accountId||family[0]!==draft.typeKey||family[1]!==b?.type||b.ownerAccountId!==accountId)return null;
 const kind=family[2],workspace={kind};
 if(['collection','edc-report','method-report','trial-report'].includes(kind))workspace.planId=kind==='collection'?b.binding?.planId:b.planId;
 if(['edc-report','method-report'].includes(kind))workspace.collectionId=b.collectionId;
 if(['method-report','trial-report'].includes(kind))workspace.runId=b.runId;
 try{myResearchDraftLink({...draft,version:draft.currentVersionNo,workspace});return workspace;}catch{return null;}
}
