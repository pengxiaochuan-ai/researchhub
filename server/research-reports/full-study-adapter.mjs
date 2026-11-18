import {createT17Reports} from '../research-analysis/t17-reports.mjs';
import {researchError} from '../research-studies/contract.mjs';
import {buildFullStudyReport,FULL_STUDY_REPORT_SCHEMA} from './full-study-content.mjs';
import {createFullStudyRenderer} from './full-study-renderer.mjs';

/** Trusted server composition only; this adapter never creates a root MethodRun. */
export function createFullStudyReportAdapter({runs,require}={}){
 if(typeof runs?.confirmedBundleInTransaction!=='function')throw new Error('FULL_STUDY_REPORT_RUNS_REQUIRED');
 return {
  schemaVersion:FULL_STUDY_REPORT_SCHEMA,
  sourceField:'runGroupId',
  defaultTitle:'整课题合成模拟汇总报告',
  async readSource(tx,user,s,studyId,runGroupId,phase='export',cache){
   if(typeof runGroupId!=='string'||!/^[A-Za-z0-9_-]{1,160}$/.test(runGroupId))throw researchError(409,'REPORT_SOURCE_INVALID','报告的固定分析来源无效，请重新核对。');
   const key='full-study:'+studyId+':'+runGroupId;
   if(cache?.runs?.has(key))return cache.runs.get(key);
   const source=await runs.confirmedBundleInTransaction(tx,user,s,studyId,runGroupId,phase);
   if(source?.studyId!==studyId||source?.runGroupId!==runGroupId)throw researchError(409,'REPORT_SOURCE_INVALID','报告的固定分析来源无效，请重新核对。');
   const value={source,basis:source.basis};cache?.runs?.set(key,value);return value;
  },
  buildContent:buildFullStudyReport,
  blockSourceId:block=>block.runGroupId,
  presentSource:(source,basis)=>({runGroupId:source.runGroupId,snapshotId:basis.snapshotId}),
  render:createFullStudyRenderer({require}),
 };
}

export function createFullStudyReports({runs,require,...dependencies}){
 return createT17Reports({...dependencies,reportAdapter:createFullStudyReportAdapter({runs,require})});
}
