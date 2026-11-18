// Admin HTTP review of only the newly named, controlled fixture materials and
// synthetic entities. Real organization/team candidates remain pending.
import assert from 'node:assert/strict';import {randomUUID,createHash} from 'node:crypto';import {writeFileSync} from 'node:fs';
import {root,base,fixture,directoryLogin,directoryRequest as req,directoryPath as path} from './directory-runtime.mjs';
const cookie=await directoryLogin('admin'),key='rh-directory-t01-20261103',ids={};
const requestKey=label=>{const x=createHash('sha256').update(key+label).digest('hex');return`${x.slice(0,8)}-${x.slice(8,12)}-4${x.slice(13,16)}-a${x.slice(17,20)}-${x.slice(20,32)}`;};
for(const row of fixture.rows){const q=new URLSearchParams({batchId:fixture.batchId,sourceRegistryId:fixture.sourceId,sourceRecordId:row.id}),detail=await req(cookie,'/api/hub-sources/review-workbook?'+q);if(detail.scope.state.status==='pending')await req(cookie,'/api/hub-sources/object-reviews','POST',{kind:'workbook',visibility:'public',expectedFingerprint:detail.scope.fingerprint,operationId:requestKey(row.id+'-review'),sourceRegistryId:fixture.sourceId,batchId:fixture.batchId,sourceRecordId:row.id},201);else assert.equal(detail.scope.state.status,'public');}
async function entity(label,kind,payload,rowIndex=0){const e=await req(cookie,path+'entities','POST',{kind,stableKey:key+'-'+label,requestKey:requestKey(label)},201);ids[label]=e.id;const current=await req(cookie,path+'entities/'+e.id);if(current.facts.some(f=>f.kind==='profile'))return;const row=fixture.rows[rowIndex],provenance=[{kind:'source_record',sourceId:fixture.sourceId,rowId:row.id,versionId:null,sourceHash:row.hash,locator:rowIndex?'用户确认记录：机构及团队范围段落':'合成事实清单：第1至5条',fieldNames:['abstract']}];await req(cookie,path+'entities/'+e.id+'/assertions','POST',{assertionKey:'profile',kind:'profile',expectedRevision:0,payload,provenance,requestKey:requestKey(label+'-profile')},201);}
await entity('organization','organization',{name:'[合成验收] 目录研究机构甲',summary:'本机合成材料，非真实机构。',organizationType:'科研机构',city:{name:'北京',region:'北京',longitude:116.4,latitude:39.9,coordinateKind:'CITY_CENTROID'}});
await entity('researcher','researcher',{name:'[合成验收] 研究者甲',summary:'用于本机目录验收的虚构人员，不是平台账号。',directions:['针灸治疗']});
await entity('real-organization','organization',{name:'中国中医科学院中医临床基础医学研究所',summary:'机构由项目用户确认；具体项目团队的正式名称、负责人及成员仍待补充。'},1);
await entity('real-team','team',{name:'灵枢心域项目研究团队（名称待确认）',summary:'范围：所内负责灵枢心域项目的具体研究团队。此名称仅为待核验候选标签，不是已确认的正式团队名称。'},1);
// T01 synthetic team is deliberately created and reviewed in the real browser,
// not silently initialized by this script.
writeFileSync(root+'.tmp/researchhub-directory/entities.json',JSON.stringify({runId:key,ids},null,2),{mode:0o600});console.log(JSON.stringify({sourcesReviewed:2,entities:4,realCandidates:'pending',syntheticTeam:'browser-create-next',noRolesOrAccountsCreated:true}));
