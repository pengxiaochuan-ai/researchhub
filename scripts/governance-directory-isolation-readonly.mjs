import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const root=new URL('../../',import.meta.url).pathname,base='http://127.0.0.1:19501',api='/api/hubs/lingshu-xinyu/';
const rt=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
assert.match(rt.ids.tenant,/^rh-kb-local-/);
const out=root+'researchhub/docs/testing/evidence/governance-directory-isolation-2026-11-16/readonly-'+Date.now()+'/';mkdirSync(out+'video',{recursive:true});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js'),browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const result={time:new Date().toISOString(),checks:[],requests:[],businessWrites:[],pageErrors:[],modelRequests:[],contexts:[],out};let active;
async function get(c,path,status=200){const start=Date.now(),r=await c.request.get(base+path);result.requests.push({path,status:r.status(),ms:Date.now()-start});assert.equal(r.status(),status,path);return r.json();}
async function make(role){const c=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out+'video'}});result.contexts.push(role);c.on('page',p=>p.on('pageerror',e=>result.pageErrors.push(e.message)));await c.route('**/api/**',r=>{const path=new URL(r.request().url()).pathname;if(!['GET','HEAD','OPTIONS'].includes(r.request().method())&&!path.startsWith('/api/auth/')){result.businessWrites.push(path);if(/agent|chat|jobs|sessions/.test(path))result.modelRequests.push(path);return r.abort();}return r.continue();});if(role!=='anonymous'){const r=await c.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:rt.ids.tenant,username:role+'@example.org',password:rt.password}});assert.equal(r.status(),201);}return c;}
const contexts=[];
try{
 const admin=await make('admin');contexts.push(admin);const owner=await make('owner');contexts.push(owner);const anon=await make('anonymous');contexts.push(anon);
 const teams=await get(owner,api+'member/teams'),researchers=await get(owner,api+'member/researchers');assert(teams.items.length&&researchers.items.length);
 const tenantOnly=teams.items.find(x=>x.provenance.some(p=>p.audience==='tenant'));assert(tenantOnly,'TENANT_ONLY_CONTROL_REQUIRED');await get(anon,api+'teams/'+tenantOnly.id,404);
 const tool='/api/hub-sources/agent-retrieval?query=';await get(anon,tool+encodeURIComponent(tenantOnly.name),401);
 for(const c of [admin,owner]){
  const actual=await get(c,tool+encodeURIComponent('针灸'));assert.equal(actual.meta.actualRetrieval,'ResearchHub-current-reviewed-PG');assert.equal(actual.mutated,false);assert(actual.meta.sources.length>0,'LIVE_POSITIVE_CONTROL_REQUIRED');
  for(const query of [tenantOnly.name,'directorycanary'+randomUUID().replaceAll('-','')]){const answer=await get(c,tool+encodeURIComponent(query));assert.equal(answer.mutated,false);for(const s of answer.meta.sources){assert(s.sourceRecordId||s.externalDocumentId||s.pmcRecordId);assert(!JSON.stringify(s).includes('rhde-'));}if(query.startsWith('directorycanary')){assert.deepEqual(answer.meta.sources,[]);assert.deepEqual(answer.meta.sourceTexts,[]);}}
 }
 result.checks.push('actual admin/owner tool GET has approved-source positive hits, only supported source identifiers; absent canary empty; anonymous denied and tenant-only team404');
 const workspaces=await get(admin,api+'directory-admin/team-workspaces');const teamId=workspaces.items?.[0]?.id??tenantOnly.id;
 for(let i=0;i<6;i++)await get(admin,api+'directory-admin/team-workspaces/'+teamId);
 await get(owner,api+'directory-admin/team-workspaces/'+teamId,403);await get(anon,api+'directory-admin/team-workspaces/'+teamId,401);
 result.checks.push('same existing admin workspace read six times serially, no503; owner403/anonymous401; does not establish historical503 root cause');
 const p=await owner.newPage();active=p;await p.goto(base+'/pages/t01/');await p.locator('#team-'+tenantOnly.id).waitFor();await p.screenshot({path:out+'tenant-team-1440.png'});await p.goto(base+'/pages/r01/');await p.locator('.scholar-card').first().waitFor();await p.screenshot({path:out+'researchers-1440.png'});
 const ap=await admin.newPage();active=ap;await ap.goto(base+'/pages/g02/?'+new URLSearchParams({view:'directory-review',team:teamId}));const dialog=ap.locator('dialog.team-workspace-dialog');await dialog.waitFor();await dialog.locator('.team-submit-actions').getByRole('button',{name:'已审核',exact:true}).waitFor();assert.equal(await dialog.getByText('正在读取机构资料…',{exact:true}).count(),0);await ap.screenshot({path:out+'admin-existing-workspace.png'});await ap.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
 result.checks.push('real owner T01/R01 and admin original review dialog open/read/Esc close, no save or review');
 assert.deepEqual(result.businessWrites,[]);assert.deepEqual(result.pageErrors,[]);assert.deepEqual(result.modelRequests,[]);result.passed=true;
}catch(e){result.passed=false;result.error=e.message;await active?.screenshot({path:out+'failure.png'}).catch(()=>{});process.exitCode=1;}
finally{for(const c of contexts)await c.close();await browser.close();writeFileSync(out+'result.json',JSON.stringify(result,null,2));console.log(JSON.stringify({passed:result.passed,error:result.error,checks:result.checks,out}));}
