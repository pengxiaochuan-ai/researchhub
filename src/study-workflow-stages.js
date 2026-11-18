import {formalUrl} from './formal-preparation-session.js';
import {analysisUrl} from './formal-analysis-session.js';
import {reportsUrl} from './formal-reports-session.js';
export function studyWorkflowStages(item,studyId){
 const c=item?.workflowCapabilities;if(item?.study?.id!==studyId||item.capabilities?.canRead!==true||!c||!['canReadVisits','canReadAnalysis','canReadReports'].every(k=>typeof c[k]==='boolean'))throw Error('研究流程暂不可核对，请重新读取概览。');
 return[
  {key:'prepare',label:'准备研究',href:formalUrl('s11',studyId),detail:item.preparation?.label||'核对方案、访视和问卷'},
  {key:'visits',label:'完成访视',href:c.canReadVisits?'#study-due-visits':null,detail:c.canReadVisits?'从今日待访视进入本次采集':'需当前研究的访视读取权限'},
  {key:'analysis',label:'分析结果',href:c.canReadAnalysis?analysisUrl(studyId):null,detail:c.canReadAnalysis?'核对计划、来源与计算结果':'需本研究的分析权限'},
  {key:'delivery',label:'审核交付',href:c.canReadReports?reportsUrl(studyId):null,detail:c.canReadReports?'预览、审核与交付固定报告':'需本研究的报告读取权限'},
 ];
}
