// Independent synthetic analysis subchain. This does not consume the main H5/email benchmark.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {workspaceRoot,fixtureEnvironment} from './research-creation-fixture.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
assert.deepEqual(process.argv.slice(2),['--local-synthetic']);const env=fixtureEnvironment();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const b=JSON.parse(readFileSync(JSON.parse(readFileSync(workspaceRoot+'.tmp/researchhub-workflow/benchmark-current.json')).acceptedFile));assert(b.syntheticOnly);
const cookies=JSON.parse(readFileSync(workspaceRoot+'.tmp/researchhub-19501-integration/preflight-cookie.json'));
const runId='rh-t15-http-'+randomUUID().slice(0,8),base='http://127.0.0.1:19501',root='/research-studies/'+b.study.id,out=workspaceRoot+'researchhub/docs/testing/evidence/research-t15-2026-11-12/'+runId+'/';mkdirSync(out,{recursive:true});
const checks=[],network=[],subjects=[],key=()=>randomUUID();let stage='preflight';
async function api(path,{method='GET',body,status=200,role='admin'}={}){const r=await fetch(base+'/api'+path,{method,headers:{Cookie:cookies[role],Origin:base,...(body?{'Content-Type':'application/json','X-ResearchHub-Request':'session-v1'}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json().catch(()=>null);network.push({stage,at:new Date().toISOString(),role,path,method,status:r.status});assert((Array.isArray(status)?status:[status]).includes(r.status),JSON.stringify({stage,path,status:r.status,code:data?.code}));return data;}
const post=(p,body,o={})=>api(p,{...o,method:'POST',body});
try{
 await withFixtureTransaction(env,'direct',async tx=>{const [m]=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${b.runId}`;assert(m?.manifest?.syntheticOnly&&m.manifest.studyId===b.study.id);},{readOnly:true});
 const release=await api(root+'/protocols/'+b.protocolId+'/release'),policy=release.policy;
 stage='independent-onsite-sources';for(let i=0;i<3;i++){
  const subject=(await post(root+'/subjects',{requestKey:key(),subjectId:'SYNTHETIC-ANALYSIS-'+i+'-'+runId.slice(-8)})).subject,p=root+'/subjects/'+subject.id+'/participation';
  for(const event of [{kind:'screening',decision:'passed',method:'manual'},{kind:'research_consent',decision:'granted',signer:'合成主体',textVersion:policy.sections.researchConsent.rules.textVersion},{kind:'data_use_consent',decision:'granted',signer:'合成主体',scope:policy.sections.dataUse.rules.scope}])await post(p+'/events',{requestKey:key(),expectedPolicyVersionId:policy.id,expectedPolicyHash:policy.contentHash,event:{...event,effectiveAt:new Date(Date.now()-1000).toISOString(),evidence:'独立合成分析子链'}});
  await post(p+'/enroll',{requestKey:key(),expectedPolicyVersionId:policy.id,expectedPolicyHash:policy.contentHash});
  const visit=(await api(root+'/visits?subjectId='+subject.id)).items.find(v=>v.visitPlan.code==='BASELINE');
  const assigned=await post(root+'/visits/'+visit.id+'/assignments',{requestKey:key(),formVersionId:b.refs.form}),a=root+'/assignments/'+assigned.result.id;
  const answers={value:i*2,optional_value:i===1?null:i*2,completed:i!==0};
  const saved=await post(a+'/submit',{requestKey:key(),expectedVersion:0,answers});
  for(const operation of ['review','lock']){const v=await api(a);await post(a+'/'+operation,{requestKey:key(),expectedVersion:v.response.version,expectedRef:v.response.ref,...(operation==='review'?{decision:'approved'}:{})});}
  subjects.push({subjectId:subject.id,visitId:visit.id,assignmentId:assigned.result.id,answers,ref:saved.result.ref,captureMode:'researcher'});
 }
 checks.push('three_new_independent_actual_form_submissions_reviewed_locked_zero_false_null_preserved');
 stage='plan';const definition={schemaVersion:'t15-synthetic-plan-v1',dataClassification:'synthetic',purposeKey:'synthetic-research-only',method:'descriptive',statisticalUnit:'subject',protocolVersionId:b.protocolId,visitCode:'BASELINE',subjectIds:subjects.map(s=>s.subjectId),variables:[['value','number'],['optional_value','number'],['completed','boolean']].map(([k,valueType])=>({key:k,fieldKey:k,formVersionId:b.refs.form,valueType,unit:null})),sapVersion:'synthetic-sap-v1',variableMapVersion:'synthetic-map-v1',reason:'全新独立合成分析子链；全部现场录入，不冒充主三渠道验收'};
 const planBody={requestKey:key(),definition},submitted=await post(root+'/analysis/plans',planBody),planId=submitted.planId;
 assert.equal((await post(root+'/analysis/plans',planBody)).planId,planId);
 assert.equal((await api(root+'/analysis/receipts/'+planBody.requestKey+'?action=analysis.plan.submit&targetId='+b.study.id)).planId,planId);
 await api(root+'/analysis/plans/'+planId,{role:'owner',status:403});
 const approved=await post(root+'/analysis/plans/'+planId+'/reviews',{requestKey:key(),expectedSequence:0,decision:'approved',reason:'明确核对合成范围、字段映射、统计单位和用途'});
 stage='preview-release';const preview=await api(root+'/analysis/plans/'+planId+'/preview');assert.equal(preview.manifest.rowCount,3);assert.equal(preview.evaluation.blockingCount,0);
 assert.deepEqual(preview.manifest.rows.map(r=>r.cells.find(c=>c.key==='value').value).sort((a,b)=>a-b),[0,2,4]);
 const releaseBody={requestKey:key(),previewHash:preview.manifestHash,reason:'核对当前固定来源后放行独立合成快照'};
 await post(root+'/analysis/plans/'+planId+'/snapshots',{...releaseBody,requestKey:key(),previewHash:'0'.repeat(64)},{status:409});
 const snapshot=await post(root+'/analysis/plans/'+planId+'/snapshots',releaseBody);
 assert.deepEqual(await api(root+'/analysis/receipts/'+releaseBody.requestKey+'?action=analysis.release&targetId='+planId),snapshot);
 const read=await api(root+'/analysis/snapshots/'+snapshot.snapshotId);assert.equal(read.basis.manifestHash,preview.manifestHash);
 const detail=await api(root+'/analysis/plans/'+planId);assert(detail.snapshots.some(s=>s.snapshotId===snapshot.snapshotId));assert(!('manifest' in detail.snapshots[0]));
 const list=await api(root+'/analysis/plans?limit=1');assert.equal(list.items.length,1);checks.push('actual_plan_review_current_preview_stale_hash_denied_atomic_release_fixed_snapshot_and_metadata_lists');
 const result={passed:true,at:new Date().toISOString(),runId,syntheticOnly:true,studyId:b.study.id,scope:b.scope,planId,snapshotId:snapshot.snapshotId,manifestHash:preview.manifestHash,subjects,checks,network,mainThreeChannelBenchmark:false,browserAcceptance:false,clinicalAcceptance:false,productionAcceptance:false};writeFileSync(out+'result.json',JSON.stringify(result,null,2));writeFileSync(workspaceRoot+'.tmp/researchhub-workflow/t15-http-current.json',JSON.stringify({acceptedFile:out+'result.json'}),{mode:0o600});console.log(JSON.stringify({passed:true,evidence:out+'result.json',checks}));
}catch(e){writeFileSync(out+'failure.json',JSON.stringify({passed:false,stage,message:e.message,subjects,checks,network},null,2));console.error(JSON.stringify({passed:false,stage,message:e.message.slice(0,1000),evidence:out+'failure.json'}));process.exitCode=1;}
