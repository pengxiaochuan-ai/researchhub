import{crfPacketFixture}from'./synthetic-crf-methods.mjs';
import{edcDigest}from'../../scripts/synthetic-edc-contract.mjs';
export function crfAiFixture(){
 const packet=crfPacketFixture();packet.binding.basis={artifactId:'plan',versionNo:2,contentHash:'content',picoConfirmationHash:'pico',sourcesHash:'sources'};
 const groups=[{evidenceId:'crfg_abc123',visitLabel:'基线',fieldLabel:'测试字段',fieldType:'number',n:3,nMissing:1,missingRate:0.333333,missingStates:{missing:0,not_measured:1,not_applicable:0},rangeSource:'explicit_manual_config',rangeObservations:[{value:12,configuredBound:10}],rangeLocations:['RAW_RECORD'],numericEvidence:[{value:12}]},{evidenceId:'crfg_def456',visitLabel:'随访',fieldLabel:'测试字段',fieldType:'number',n:3,nMissing:3,rangeSource:'explicit_manual_config',rangeObservations:[],rangeLocations:[],numericEvidence:[]}];
 const result={schema:'rh-synthetic-crf-method-result.v1',evidenceGroups:groups},view={id:'run',inputHash:'input-hash',resultHash:edcDigest(result),runVersion:'2026-10-25T00:00:00.000Z',status:'needs_review',sourceStatus:'current',collectionId:'collection',input:{binding:packet.binding,dataBasis:{dataRevision:0,dataHash:'data',configHash:packet.binding.configHash},quality:{id:'quality',findingsHash:'findings'}},result};
 return{packet,view,ids:groups.map(g=>g.evidenceId),sources:[{quote:'合成资料仅用于软件验证。样本量为30例。需研究者核对资料适用范围。',docId:'doc',chunkId:'chunk'}],pico:{p:'三十名合成人员',i:'测试干预',c:'测试对照',o:'测试结局'}};
}
