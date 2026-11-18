// One already-approved C05 grant only. Supports testing a reader without changing its browser session.
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {loadCatalogTarget,executeCatalogSchema} from '../../scripts/research-assets-catalog-schema.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import {createAssetCatalogClient} from '../../src/research-assets-catalog-client.js';
assert.equal(process.argv[2],'--revoke-one-active-c05','EXPLICIT_NAMED_C05_REVOKE_REQUIRED');
const {env,ids}=loadCatalogTarget();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');assert.equal((await executeCatalogSchema()).action,'verified');
const rows=await withFixtureTransaction(env,'direct',t=>t.$queryRawUnsafe("SELECT x.asset_id,x.request_id,x.revision FROM rh_asset.access_request x JOIN rh_asset.asset_registry r ON r.asset_id=x.asset_id JOIN public.research_artifact a ON a.id=r.asset_id WHERE x.tenant_id=$1 AND x.study_group_id=$2 AND x.research_project_id=$3 AND x.recipient_account_id=$4 AND x.state='approved' AND x.purpose LIKE 'C05合成验收：%' AND r.owner_account_id=$5 AND r.asset_kind='protocol' AND a.\"idempotencyKey\"='rh-research-asset:catalog-20261112:admin:protocol'",ids.tenant,ids.group,ids.project,ids.owner,ids.admin),{readOnly:true});assert.equal(rows.length,1,'EXACTLY_ONE_APPROVED_C05_GRANT_REQUIRED');
const row=rows[0],origin='http://127.0.0.1:19501',runtime=JSON.parse(readFileSync(new URL('../../../.tmp/researchhub-knowledge-local/runtime.json',import.meta.url),'utf8'));
const login=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-ResearchHub-Request':'session-v1'},body:JSON.stringify({tenantSlug:ids.tenant,username:'admin@example.org',password:runtime.password})});assert.equal(login.status,201);
const cookie=login.headers.getSetCookie().map(x=>x.split(';')[0]).join(';'),user=await(await fetch(origin+'/api/auth/me',{headers:{Cookie:cookie}})).json();assert.equal(user.accountId,ids.admin);
const api=createAssetCatalogClient({user,scope:{studyGroupId:ids.group,researchProjectId:ids.project},fetchImpl:(u,i)=>fetch(origin+u,{...i,headers:{...i.headers,Origin:origin,Cookie:cookie}})}),o=await api.get('/research-assets/'+row.asset_id+'/usage?version=1');
const input={action:'revoke',version:1,expectedRevision:o.expectedRevision,identityRevision:o.identityRevision,contentHash:o.contentHash,policyHash:o.policyHash,requestId:row.request_id,expectedRequestRevision:row.revision,requestKey:'c05-revoke-'+row.request_id+'-'+row.revision,reason:'C05合成验收：结束本次许可，核对已打开页面和复制动作及时停止。'};
const receipt=await api.post('/research-assets/'+row.asset_id+'/grants/'+row.request_id+'/revocations',input);assert.equal(receipt.operation,'grant_revoked');
console.log(JSON.stringify({syntheticOnly:true,realHttp:true,receipt,businessWrites:1,modelsCalled:0},null,2));
