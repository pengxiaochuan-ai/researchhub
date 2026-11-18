import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {loadCatalogTarget,bindCatalogContext} from './research-assets-catalog-schema.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {readBusinessAssetAdmission,readBusinessSourceProtection} from './research-assets-business-preflight.mjs';

assert.deepEqual(process.argv.slice(2),['--read-only']);
const {env,ids}=loadCatalogTarget();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const root=fileURLToPath(new URL('../../',import.meta.url)),runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
const directory=new URL('../docs/planning/research-assets-completion-2026-11-16/evidence/',import.meta.url);
const browserResult=JSON.parse(readFileSync(new URL('browser-c1/result.json',directory)));assert.equal(browserResult.passed,true);assert.equal(browserResult.assets.length,8);assert.equal(browserResult.events.length,48);
const sourceBaseline=JSON.parse(readFileSync(new URL('business-source-protection.json',directory))),baseline=JSON.parse(readFileSync(new URL('business-preflight.json',directory)));
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),request=pw.request??pw.default.request,base='http://127.0.0.1:19501';
const clients={},checks=[];
function headers(actor,project,extra={}){return{'X-Study-Group-Id':ids.group,'X-Research-Project-Id':project,'X-ResearchHub-Actor':ids[actor],'X-ResearchHub-Auth-Version':String(clients[actor].user.authVersion),...extra};}
async function get(actor,project,path,extra={}){const r=await clients[actor].context.get('/api'+path,{headers:headers(actor,project,extra)});return{status:r.status(),value:await r.json()};}
try{
 for(const actor of ['owner','admin']){
  const context=await request.newContext({baseURL:base});const r=await context.post('/api/auth/login',{headers:{Origin:base},data:{tenantSlug:ids.tenant,username:actor+'@example.org',password:runtime.password}});assert(r.ok());
  const user=await(await context.get('/api/auth/me')).json();assert.equal(user.accountId,ids[actor]);clients[actor]={context,user};
 }
 const own=browserResult.assets.find(a=>a.actor==='owner'&&a.label==='B'),other=browserResult.assets.find(a=>a.actor==='admin'&&a.label==='B');
 const forbidden=await get('owner',other.project,'/research-assets/catalog/'+other.id+'/versions/2');assert.equal(forbidden.status,404);assert(!Object.hasOwn(forbidden.value,'contentMd'));assert(!JSON.stringify(forbidden.value).includes(other.title));checks.push('ordinary researcher receives no private admin body or title');
 const wrong=await get('owner',ids.project,'/research-assets/catalog/'+own.id+'/versions/2');assert.equal(wrong.status,404);assert(!Object.hasOwn(wrong.value,'contentMd'));checks.push('wrong true Study cannot deliver a known owned asset');
 for(const extra of [{'X-ResearchHub-Actor':ids.admin},{'X-ResearchHub-Auth-Version':String(clients.owner.user.authVersion+1)}]){const denied=await get('owner',own.project,'/research-assets/catalog/'+own.id+'/versions/2',extra);assert.equal(denied.status,409);assert(!Object.hasOwn(denied.value,'contentMd'));}checks.push('actor switching or stale intent header cannot reuse an open page');
 const missing=await clients.admin.context.get('/api/research-assets/catalog/'+other.id+'/versions/2');assert.equal(missing.status(),400);checks.push('missing explicit scope is rejected before the service despite method metadata override');
 const admin=await get('admin',own.project,'/research-assets/catalog/'+own.id+'/versions/2');assert.equal(admin.status,200);assert.equal(admin.value.state,'approved');checks.push('current tenant admin reads B without a fabricated Study membership');
 const capacity=await get('owner',own.project,'/research-assets/registrable-sources');assert.equal(capacity.value.admission.canCreate,false);assert.equal(capacity.value.ownAssets.length,2);checks.push('exhausted local scope is declared before another registration form');
 for(const version of ['9','2147483647']){const absent=await get('owner',own.project,'/research-assets/overview?selectedAssetId='+own.id+'&selectedVersion='+version);assert.equal(absent.status,404);assert(!Object.hasOwn(absent.value,'contentMd'));}
 const legacyRange=await get('owner',own.project,'/research-assets/overview?selectedAssetId=legacy-asset&selectedVersion=9');assert.equal(legacyRange.status,400);checks.push('business high-version syntax reaches the missing-version check while legacy range stays bounded');
 const pg=await withFixtureTransaction(env,'direct',async tx=>{
  await bindCatalogContext(tx,ids,ids.admin);
  const admission=await readBusinessAssetAdmission(tx,ids),sources=await readBusinessSourceProtection(tx,ids);
  assert.equal(admission.protectionHash,baseline.protectionHash);assert.deepEqual(sources,sourceBaseline);
  const rows=await tx.$queryRawUnsafe("SELECT r.asset_id,r.owner_account_id,r.research_project_id,r.working_version_no,r.revision,r.working_state,r.release_state,(SELECT count(*)::int FROM rh_asset.version_policy p WHERE p.asset_id=r.asset_id) AS versions,(SELECT count(*)::int FROM rh_asset.asset_event e WHERE e.asset_id=r.asset_id) AS events FROM rh_asset.asset_registry r WHERE tenant_id=$1 AND asset_id=ANY($2::text[]) ORDER BY asset_id",ids.tenant,browserResult.assets.map(a=>a.id));
  assert.equal(rows.length,8);assert(rows.every(r=>r.working_version_no===2&&r.revision===6&&r.working_state==='approved'&&r.release_state==='unreleased'&&r.versions===2&&r.events===6));
  assert.deepEqual(rows.map(r=>r.asset_id).sort(),browserResult.assets.map(a=>a.id).sort());
  // Freeze this completed batch separately. Do not replace the original 27-row
  // baseline or recompute a fresh baseline when a later fixture batch begins.
  const assetIds=rows.map(r=>r.asset_id),facts={};
  for(const table of ['asset_registry','version_policy','asset_event','access_request','asset_comment_event','asset_reuse_record'])facts[table]=await tx.$queryRawUnsafe(`SELECT asset_id,md5(to_jsonb(t)::text) AS fingerprint FROM rh_asset.${table} t WHERE tenant_id=$1 AND asset_id=ANY($2::text[]) ORDER BY asset_id,to_jsonb(t)::text`,ids.tenant,assetIds);
  const artifacts=await tx.researchArtifact.findMany({where:{tenantId:ids.tenant,id:{in:assetIds}},include:{versions:{orderBy:{versionNo:'asc'},include:{sources:{orderBy:{id:'asc'}}}},reviews:{orderBy:{id:'asc'}},files:{orderBy:{id:'asc'}}},orderBy:{id:'asc'}});
  const hash=createHash('sha256').update(JSON.stringify({facts,artifacts},(_k,v)=>typeof v==='bigint'?String(v):v)).digest('hex');
  const snapshot={schema:'rh-assets-completed-c1-batch.v1',assetIds,hash},snapshotPath=new URL('business-batch-c1-protection.json',directory);
  if(existsSync(snapshotPath))assert.deepEqual(snapshot,JSON.parse(readFileSync(snapshotPath)),'Completed C1 batch changed; never reset its baseline');
  else writeFileSync(snapshotPath,JSON.stringify(snapshot,null,2),{flag:'wx'});
  const adminB=await tx.researchProjectMembership.count({where:{tenantId:ids.tenant,researchProjectId:own.project,accountId:ids.admin}});assert.equal(adminB,0);
  const roles=await tx.studyGroupMembership.findMany({where:{tenantId:ids.tenant,studyGroupId:ids.group,accountId:{in:[ids.owner,ids.admin]}},select:{accountId:true,role:{select:{id:true,key:true,menuPermissions:true,buttonPermissions:true}}}});
  return{oldFactsUnchanged:true,oldSourcesRolesLedgerAndStartupFilesUnchanged:true,completedBatchHash:hash,adminBMemberships:adminB,newAssets:rows.length,newVersions:16,newEvents:48,allPrivateUnreleased:true,ddlFingerprint:admission.ddlFingerprint,roles};
 },{readOnly:true});
 const result={passed:true,at:new Date().toISOString(),checks,pg,dataWrites:0,modelCalls:0};writeFileSync(new URL('business-current-auth-readonly.json',directory),JSON.stringify(result,null,2));
 console.log(JSON.stringify({passed:true,checks,pg:{...pg,roles:pg.roles.map(r=>({accountId:r.accountId,role:r.role.key,menus:r.role.menuPermissions,assetPermissions:r.role.buttonPermissions.filter(x=>x.startsWith('artifact.'))}))},dataWrites:0,modelCalls:0}));
}finally{for(const c of Object.values(clients))await c.context.dispose();}
