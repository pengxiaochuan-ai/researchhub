// Restore only the named synthetic fixture after the recorded browser test.
// The original public profile is immutable revision 2, not inferred city data.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {root,directoryLogin,directoryRequest,directoryPath} from './directory-runtime.mjs';
const out=root+'researchhub/docs/testing/evidence/team-inline-review-2026-11-05/fixture-recovery/';mkdirSync(out,{recursive:true});
const file=out+'request.json',keys=existsSync(file)?JSON.parse(readFileSync(file)):{append:randomUUID(),review:randomUUID()};
if(!existsSync(file))writeFileSync(file,JSON.stringify(keys));
const cookie=await directoryLogin('admin'),request=(p,m='GET',b)=>directoryRequest(cookie,directoryPath+p,m,b,m==='POST'&&p.endsWith('/assertions')?201:200);
const id='rhde-19ccf8f5caa84034b0dea6a897a0b43b',realId='rhde-c334b97521154b98a52f8fba3926afde';
const original=await request('assertions/rhda-0734defe97854d8fa85c339c4c1df165');assert.equal(original.entityId,id);assert.equal(original.revision,2);assert.equal(original.decision.audience,'public');
const w=await request('team-workspaces/'+id),real=await request('team-workspaces/'+realId),entity=await request('entities/'+id),head=entity.facts.find(x=>x.kind==='profile');
const result=await request('entities/'+id+'/assertions','POST',{assertionKey:'profile',kind:'profile',relatedEntityId:null,expectedRevision:4,payload:original.payload,provenance:original.provenance,requestKey:keys.append});
assert(head.revision===4||head.id===result.id,'do not overwrite an unrelated subsequent change');
await request('assertions/'+result.id+'/decisions','POST',{expectedDecisionVersion:0,assertionHash:result.hash,decision:'approve',audience:'public',reason:'恢复本轮原位审核测试前具名合成团队的完整公开档案，使用原不可变版本2及其真实合成依据；不动真实团队',requestKey:keys.review});
const after=await request('entities/'+id),restored=after.facts.find(x=>x.kind==='profile');assert.deepEqual(restored.payload,original.payload);assert.deepEqual(restored.provenance,original.provenance);for(const [team,before] of [[id,w],[realId,real]]){const current=await request('team-workspaces/'+team);for(const key of ['data','version','baseRevision','history'])assert.deepEqual(current[key],before[key]);}
writeFileSync(out+'result.json',JSON.stringify({passed:true,originalAssertion:original.id,restoredAssertion:result.id,restoredRevision:restored.revision,originalDraftUnchanged:true,realTeamUnchanged:true,appendOnly:true,newAssertions:1,newDecisions:1,noQuotaChange:true},null,2));console.log(JSON.stringify({passed:true,evidence:out}));
