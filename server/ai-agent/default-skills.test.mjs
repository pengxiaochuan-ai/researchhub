import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {loadSkillCatalog} from './skill-catalog.mjs';
import {createHubDefaultSkills} from './default-skills.mjs';

const require=createRequire(import.meta.url);
const {resolveEffectiveSkillCatalog}=require('../../../app/server/dist/agents/effective-skills-policy.js');
const catalog=await loadSkillCatalog(new URL('../../',import.meta.url));
const admin={tenantId:'hub-tenant',accountId:'admin',authVersion:0};

function fixture(){
 const accounts=new Map([['admin',{id:'admin',role:'tenant_admin',isTenantAdmin:true,status:'active',authVersion:0}],['owner',{id:'owner',role:'researcher',status:'active',authVersion:0}]]);
 const skills=[],assignments=[],audits=[];
 const admissions=new Map([['admin','approved'],['owner','approved']]);
 const matches=(row,where)=>Object.entries(where).every(([k,v])=>k==='skill'?row.skill.status===v.status:v&&typeof v==='object'&&'in'in v?v.in.includes(row[k]):row[k]===v);
 const tx={
  $queryRawUnsafe:async(sql,...args)=>sql.startsWith('SELECT status FROM rh_admission')?(admissions.has(args[2])?[{status:admissions.get(args[2])}]:[]):[],
  tenant:{findFirst:async({where})=>where.id==='hub-tenant'?{id:'hub-tenant',status:'active'}:null},
  agent:{findFirst:async({where})=>where.id==='hub-agent'&&where.tenantId==='hub-tenant'?{id:'hub-agent',tenantId:'hub-tenant',type:'research',status:'active'}:null},
  account:{findFirst:async({where})=>{const a=accounts.get(where.id);return where.tenantId==='hub-tenant'&&a?{...a,tenantId:'hub-tenant'}:null;}},
  skill:{findFirst:async({where})=>skills.find(s=>matches(s,where))??null,create:async({data})=>{skills.push({...data});return data;}},
  skillAssignment:{findFirst:async({where})=>assignments.find(a=>matches(a,where))??null,create:async({data})=>{const row={...data,skill:skills.find(s=>s.id===data.skillId)};assignments.push(row);return row;},findMany:async({where})=>assignments.filter(a=>matches(a,where))},
  auditLog:{createMany:async({data})=>audits.push(data)},
 };
 const service=createHubDefaultSkills({scope:{product:'researchhub',allowedTenantIds:['hub-tenant']},tenantId:'hub-tenant',agentId:'hub-agent',catalog,resolveEffectiveSkillCatalog,lockAuthorization:async()=>{},transaction:fn=>fn(tx)});
 return{service,skills,assignments,audits,accounts,admissions};
}

test('nine tenant defaults cover existing and future accounts without per-account grants',async()=>{
 const f=fixture();await f.service.install(admin);
 assert.equal(f.skills.length,9);assert.equal(f.assignments.length,9);
 assert(f.assignments.every(a=>a.accountId===null&&a.scopeKey==='*'&&a.enabled));
 assert.equal((await f.service.list({...admin,accountId:'owner'})).items.length,9);
 f.accounts.set('new-registration',{id:'new-registration',role:'researcher',status:'active',authVersion:0});
 await assert.rejects(f.service.list({...admin,accountId:'new-registration'}),e=>e.code==='HUB_ADMISSION_REQUIRED');
 f.admissions.set('new-registration','approved');
 const current=await f.service.list({...admin,accountId:'new-registration'});
 assert.equal(current.items.length,9);assert(current.items.every(s=>s.equipped&&!s.executionReady));
 assert(!JSON.stringify(current).includes('reviewedBy'));assert(!JSON.stringify(current).includes('scopeKey'));
});

test('rerun is idempotent and never undoes an administrator default/account disable',async()=>{
 const f=fixture();await f.service.install(admin);f.assignments[0].enabled=false;
 f.assignments.push({...f.assignments[1],id:'override',scopeKey:'owner',accountId:'owner',enabled:false});
 const before=f.audits.length;await f.service.install(admin);
 assert.equal(f.skills.length,9);assert.equal(f.assignments.length,10);assert.equal(f.audits.length,before);
 assert.equal((await f.service.list({...admin,accountId:'owner'})).items.length,7);
 assert.equal((await f.service.list(admin)).items.length,8);
});

test('no anonymous, cross-tenant, stale or disabled identity can read defaults or install them',async()=>{
 const f=fixture();
 for(const u of [null,{...admin,tenantId:'other'},{...admin,authVersion:1}]){
  await assert.rejects(()=>f.service.list(u));await assert.rejects(()=>f.service.install(u));
 }
 await assert.rejects(()=>f.service.install({...admin,accountId:'owner'}),/HUB_SKILL_ADMIN_REQUIRED/);
 f.accounts.get('admin').status='disabled';await assert.rejects(()=>f.service.install(admin));
 assert.equal(f.skills.length,0);
 assert.throws(()=>createHubDefaultSkills({scope:{product:'legacy',allowedTenantIds:['hub-tenant']},tenantId:'hub-tenant',agentId:'hub-agent',catalog}),/HUB_SKILL_DEPLOYMENT_REQUIRED/);
});

test('published source/release drift and unpublished versions cannot silently re-enable',async()=>{
 const f=fixture();await f.service.install(admin);
 f.skills[0].intent+='changed';await assert.rejects(()=>f.service.install(admin),/HUB_SKILL_RELEASE_CHANGED/);
 const available=(await f.service.list(admin)).items;
 assert.equal(available.length,8);
 assert.ok(!available.some(item=>item.id===f.skills[0].id));
 assert.ok(available.some(item=>item.key==='doubao-medical-literature-interpretation'));
 f.skills[0].status='draft';assert.equal((await f.service.list(admin)).items.length,8);
});

test('a downgraded account cannot publish through a stale tenant-admin boolean',async()=>{
 const f=fixture();f.accounts.get('owner').isTenantAdmin=true;
 await assert.rejects(()=>f.service.install({...admin,accountId:'owner'}),/HUB_SKILL_ADMIN_REQUIRED/);
 assert.equal(f.skills.length,0);assert.equal(f.assignments.length,0);assert.equal(f.audits.length,0);
});
