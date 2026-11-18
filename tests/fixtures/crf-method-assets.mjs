import {syntheticEdcConfig} from './synthetic-edc.mjs';
import {edcDigest} from '../../scripts/synthetic-edc-contract.mjs';
import {renderCrfMethodReport} from '../../scripts/synthetic-crf-methods-report-contract.mjs';
// Hand-authored, synthetic contract input only. Never used as a real report/DB seed.
export function crfMethodAssetFixture(){
 const facts={schema:'rh-synthetic-crf-method-report.v1',syntheticOnly:true,reviewRequired:true,
  packet:{id:'collection',versionId:'packet-version',versionNo:7},
  binding:{planId:'plan',parentRootVersionNo:3},pico:{p:'合成研究对象'},config:syntheticEdcConfig(),
  basis:{dataRevision:1,dataHash:'a'.repeat(64),configHash:'b'.repeat(64)},quality:{id:'dq',findingsHash:'c'.repeat(64)},
  recordVersions:[{recordId:'record-1',syntheticSubjectKey:'SIM_01',visitKey:'baseline',formKey:'crf',status:'completed',responseRevision:2}],
  method:{runId:'method-run',runVersion:'2026-10-26T00:00:00.000Z',inputHash:'d'.repeat(64),resultHash:'e'.repeat(64),manifestHash:'f'.repeat(64),executor:'research-data-quality',workerVersion:'t19-1',adapterVersion:'crf-quality-adapter.v1'},
  coverage:{scope:'own_synthetic_packet',included:['missing-rate','range-check','own_packet_counts'],notExamined:['enrollment','scales','files','time_order','leakage','duplicate_timestamp','group_balance','repeated_measure_inference','study_completeness','analysis_release'],rangeRule:'explicit_manual_config_only'},
  result:{packetCounts:{syntheticSubjects:3,syntheticVisitRecords:6},evidenceGroups:[{evidenceId:'actual-group',visitLabel:'基线',fieldLabel:'合成观察',n:3,nMissing:1,missingRate:0.333333,missingStates:{missing:1,not_measured:0,not_applicable:0},rangeSource:'explicit_manual_config',rangeObservations:[{side:'max',value:12,configuredBound:10}]}]},
  sources:[{docId:'document',kbId:'knowledge',chunkId:'chunk',docTitle:'已审核合成方法资料',version:2,contentHash:'1'.repeat(64),chunkHash:'2'.repeat(64),quote:'仅供软件合成验证。',page:null,section:null,via:'vector',retrievedAt:'2026-10-26T00:00:00.000Z'}],
  ai:{status:'not_requested'}};
 facts.config.notes='前序配置说明，不应进入复用配方';
 const report={id:'method-report',typeKey:'data_quality_report',status:'draft',version:2,currentVersion:2,sourceStatus:'current',facts,factsHash:edcDigest(facts),notes:'本人原报告说明'};
 report.contentMd=renderCrfMethodReport(facts,report.notes);
 return {report,reportVersionId:'report-version-2',run:{id:'method-run',collectionId:'collection',inputHash:facts.method.inputHash,resultHash:facts.method.resultHash,status:'needs_review',sourceStatus:'current'}};
}
