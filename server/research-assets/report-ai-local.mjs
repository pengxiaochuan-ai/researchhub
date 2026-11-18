// The local synthetic admission is separate from formal product semantics.
// Creating these consent events still requires the explicit migration/fixture
// approval; this module itself never connects, writes or grants runtime access.
export const REPORT_AI_LOCAL=Object.freeze({tenantId:'rh-kb-local-b0e2af9d-tenant',studyGroupId:'rh-kb-local-b0e2af9d-group',researchProjectId:'cmwczp5hk0003lud9lsla5b75',studyId:'rh-study-72203d59-4db8-4e74-9444-edff3b088b6d',accountId:'rh-kb-local-b0e2af9d-admin',assetId:'rhab-cc8fc61a-38f6-4cf0-96f7-17d11252d7f2',assetVersion:2,artifactVersionId:'cmwk3xmxg0009lubifhlxajii',contentHash:'668c2f336806db23e8aa19bbbb1823f18c8f1d4e7cb1d5c05ea7cb6fc52a8d2b',policyHash:'92778b8cc4e23e4c636c823a78cf20a8d81f2d6a1cedb700318c210958baf060',sourceReportId:'rh-formal-report-2d0c1ee7-a6b9-48b9-8433-f47be111ae58',sourceReportVersion:1,providerScope:'deepseek',purpose:'research_report_qa',basisReference:'aq-c2-user-20261117',materialBasisHash:'a33f7e54c887fd89782d8ab50434108c5659b3c6996b63f6027766de7b9159d4'});
const fail=()=>{throw Error('REPORT_AI_LOCAL_ADMISSION_REJECTED');};
export function assertReportAiLocalTarget(value){if(!value||Object.entries(REPORT_AI_LOCAL).some(([k,v])=>value[k]!==v))fail();return true;}
export function assertReportAiLocalEvent(value,prior){
 assertReportAiLocalTarget(value);const r=value.revision,start=Date.parse(value.startsAt),end=Date.parse(value.expiresAt);
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>7*86400000||![1,2,3].includes(r)||value.eventKind!==(r===2?'revoke':'grant')||r!==(prior?.revision??0)+1)fail();
 if(prior){assertReportAiLocalTarget(prior);if(value.startsAt!==prior.startsAt||value.expiresAt!==prior.expiresAt||prior.eventKind!==(r===2?'grant':'revoke'))fail();}
 return true;
}
