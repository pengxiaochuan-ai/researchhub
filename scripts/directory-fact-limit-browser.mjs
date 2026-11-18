// Only named, pending, closed synthetic relations; no approvals or profile edits.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {root,base,runtime,directoryLogin,directoryRequest,directoryPath} from './directory-runtime.mjs';
import {direct} from '../server/wp02/test-support.mjs';
const run=randomUUID(),out=root+'researchhub/docs/testing/evidence/directory-fact-limit-removal-2026-11-06/'+run+'/';mkdirSync(out,{recursive:true});
const admin=await directoryLogin('admin'),owner=await directoryLogin('owner'),team='rhde-19ccf8f5caa84034b0dea6a897a0b43b',real='rhde-c334b97521154b98a52f8fba3926afde';
const api=(path,method='GET',body,status=200,cookie=admin)=>directoryRequest(cookie,directoryPath+path,method,body,status);
const facts=()=>direct(tx=>tx.$queryRaw`SELECT id,content_sha256 AS hash FROM rh_directory.assertion WHERE tenant_id=${runtime.ids.tenant} AND hub_key='lingshu-xinyu' ORDER BY id`);
const decisions=()=>direct(async tx=>(await tx.$queryRaw`SELECT count(*)::int AS n FROM rh_directory.decision WHERE tenant_id=${runtime.ids.tenant} AND hub_key='lingshu-xinyu'`)[0].n);
const shape=w=>({version:w.version,data:w.data,history:w.history,savedAt:w.savedAt,baseRevision:w.baseRevision});
const before=await facts(),decisionBefore=await decisions(),draft=await api('team-workspaces/'+team),realBefore=shape(await api('team-workspaces/'+real));
const publicBefore=await directoryRequest(admin,'/api/hubs/lingshu-xinyu/teams/'+team),source=(await api('sources')).items.find(x=>x.title==='[合成验收] T01目录事实清单');assert(source);
const person=draft.currentData.members.find(x=>x.entityId)?.entityId,org=draft.currentData.organization.entityId;assert(person&&org);
const created=[],errors=[],network=[];let browser;
try{
 const n=process.argv.includes('--browser-only')?0:Math.max(1,41-before.length);assert(n<=6,'bounded new fixtures only');
 for(let i=0;i<n;i++)created.push(await api('entities/'+person+'/assertions','POST',{assertionKey:'affiliation:fact-cap-20261106-'+run+'-'+i,kind:'affiliation',relatedEntityId:org,expectedRevision:0,payload:{current:false,isPrimaryForDisplay:false,positionTitle:'仅本机上限验证，不代表真实任职'},provenance:[{...source.reference,locator:'具名合成关闭关系验证，不代表真实任职',fieldNames:['abstract']}],requestKey:randomUUID()},201));
 const after=await facts(),ids=new Set(before.map(x=>x.id));assert(after.length>40);assert.deepEqual(after.filter(x=>ids.has(x.id)),before);assert.equal(await decisions(),decisionBefore);
 for(const f of created){const a=await api('assertions/'+f.id);assert.equal(a.payload.current,false);assert(!a.decision||a.decision.decision!=='approve');}
 assert.deepEqual(shape(await api('team-workspaces/'+team)),shape(draft));assert.deepEqual(shape(await api('team-workspaces/'+real)),realBefore);assert.deepEqual((await directoryRequest(admin,'/api/hubs/lingshu-xinyu/teams/'+team)).item,publicBefore.item);
 await api('entities/'+person,'GET',undefined,403,owner);
 const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');browser=await (pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const ctx=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out+'video',size:{width:1440,height:900}}});
 assert.equal((await ctx.request.post(base+'/api/auth/login',{data:{tenantSlug:runtime.ids.tenant,username:'admin@example.org',password:runtime.password}})).status(),201);
 const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});p.on('response',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))network.push({path:new URL(r.url()).pathname,status:r.status()});});
 await p.goto(base+'/pages/g02/?view=directory-review');await p.getByRole('button',{name:'维护资料：[合成验收] 针灸情志研究团队',exact:true}).click();await p.getByLabel('审核理由',{exact:true}).waitFor();await p.getByRole('button',{name:'审核通过并展示',exact:true}).waitFor();await p.screenshot({path:out+'g02-unchanged.png',fullPage:true});
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);assert(network.some(x=>x.path.endsWith('/team-workspaces/'+team)&&x.status===200));await ctx.close();
 writeFileSync(out+'result.json',JSON.stringify({passed:true,run,before:before.length,after:after.length,created:created.map(x=>x.id),decisionBefore,decisionAfter:await decisions(),historyPreserved:true,publicAndPrivateTeamUnchanged:true,realTeamUnchanged:true,errors,network,paidCalls:0},null,2));console.log(JSON.stringify({passed:true,before:before.length,after:after.length,evidence:out}));
}catch(e){writeFileSync(out+'failure.json',JSON.stringify({passed:false,created:created.map(x=>x.id),message:e.message,errors,network},null,2));throw e;}finally{await browser?.close();}
