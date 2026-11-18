import test from 'node:test';
import assert from 'node:assert/strict';
const {createDueVisitsService}=await import('./due-visits.mjs').catch(()=>({}));
const scope={tenantId:'tenant',studyGroupId:'group',researchProjectId:'project'},principal={accountId:'actor',tenantId:'tenant',authVersion:0};
const day='2026-11-17',start=new Date(day+'T00:00:00+08:00'),end=new Date('2026-11-18T00:00:00+08:00');
function visit(id,extra={}){return{id,...scope,acceptanceFixture:false,subjectId:'subject',enrollmentId:'enrollment',visitPlanId:'plan',protocolVersionId:'protocol',status:'planned',scheduleState:'scheduled',targetDate:start,windowStart:start,windowEnd:end,subject:{id:'subject',...scope,subjectId:'SYNTHETIC',deletedAt:null,acceptanceFixture:false,sex:'PRIVATE-EXTRA'},enrollment:{id:'enrollment',...scope,subjectId:'subject',protocolVersionId:'protocol',status:'enrolled',acceptanceFixture:false},visitPlan:{id:'plan',...scope,protocolVersionId:'protocol',name:'固定访视',code:'BASELINE',protocolVersion:{id:'protocol',...scope,status:'executing',acceptanceFixture:false}},protocolVersion:{id:'protocol',...scope,status:'executing',acceptanceFixture:false},...extra};}
function matches(row,where){return Object.entries(where).every(([k,v])=>k==='OR'?v.some(x=>matches(row,x)):k==='AND'?v.every(x=>matches(row,x)):v&&typeof v==='object'&&!(v instanceof Date)?'in'in v?v.in.includes(row[k]):'lt'in v?row[k]!=null&&new Date(row[k])<v.lt:'gt'in v?row[k]>v.gt:!!row[k]&&matches(row[k],v):row[k]===v);}
const project=(row,select)=>Object.fromEntries(Object.entries(select).map(([k,v])=>[k,v===true?row[k]:row[k]==null?null:project(row[k],v.select)]));
function fixture(rows,at='2026-11-17T02:00:00.000Z'){
 assert.equal(typeof createDueVisitsService,'function','WF05 read-only service must exist');
 const calls=[],writes=[],ctx={...scope,executionProjectId:scope.researchProjectId};let time=Date.parse(at),actor={...principal},denied=null;
 const tx=new Proxy({subjectVisit:{findMany:async input=>{calls.push(input);return rows.filter(r=>matches(r,input.where)).sort((a,b)=>a.id.localeCompare(b.id)).slice(0,input.take).map(r=>project(r,input.select));}}},{get:(target,name)=>{if(name in target)return target[name];return new Proxy({},{get:(_,method)=>()=>{writes.push([name,method]);throw Error('UNEXPECTED_MODEL_ACCESS');}});}});
 const auth=[],transactions=[];const service=createDueVisitsService({studies:{withResearchStudyTransaction:async(user,id,operation,fn)=>{transactions.push({user,id,operation});return fn(tx,ctx);}},core:{authorize:async(...args)=>{auth.push(args.slice(1));if(denied)throw denied;return actor;}},now:()=>time});
 return{service,calls,writes,auth,transactions,get time(){return time;},set time(value){time=value;},set actor(value){actor=value;},deny(value){denied=value;}};
}
test('Beijing day uses one injected server clock and preserves current DB actor/version 0 read authorization',async()=>{
 const f=fixture([visit('v1')]);const out=await f.service.list(principal,'study');assert.equal(out.day,day);assert.equal(out.timeZone,'Asia/Shanghai');assert.equal(f.auth[0][3],'read');assert.equal(f.transactions[0].operation,'read');assert.equal(f.calls[0].take,6);assert.deepEqual(f.calls[0].orderBy,{id:'asc'});assert.equal(JSON.stringify(out).includes('PRIVATE-EXTRA'),false);assert.deepEqual(f.writes,[]);
 f.time=Date.parse('2026-11-16T15:59:59.999Z');assert.equal((await f.service.list(principal,'study')).day,'2026-11-16');f.time=Date.parse('2026-11-16T16:00:00.000Z');assert.equal((await f.service.list(principal,'study')).day,day);
 f.actor={...principal,accountId:'other'};await assert.rejects(async()=>f.service.list(principal,'study'),e=>e.status===401);
});
test('calendar-day window filtering excludes tomorrow/terminated/fixtures before take and keeps actual in-progress and superseded fixed versions',async()=>{
 const rows=[visit('01-future',{windowStart:end}),visit('02-null-date',{windowStart:null,targetDate:null}),visit('03-anchor',{scheduleState:'pending_anchor'}),visit('04-completed',{status:'completed'}),visit('05-cancelled',{status:'cancelled'}),visit('06-fixture',{acceptanceFixture:true}),visit('07-withdrawn',{enrollment:{...visit('x').enrollment,status:'withdrawn'}}),visit('08-deleted',{subject:{...visit('x').subject,deletedAt:start}}),visit('09-other-scope',{tenantId:'foreign'}),visit('10-overdue',{windowEnd:new Date(start-1)}),visit('11-tonight',{windowStart:new Date('2026-11-17T23:00:00+08:00')}),visit('12-fallback',{windowStart:null,targetDate:start}),visit('13-progress-future',{status:'in_progress',windowStart:end}),visit('14-old',{protocolVersion:{...visit('x').protocolVersion,status:'superseded'},visitPlan:{...visit('x').visitPlan,protocolVersion:{...visit('x').protocolVersion,status:'superseded'}}})];
 const f=fixture(rows),out=await f.service.list(principal,'study');assert.deepEqual(out.items.map(x=>x.visitId),['10-overdue','11-tonight','12-fallback','13-progress-future','14-old']);assert.equal(out.items[0].attention,'overdue');assert.equal(out.items[1].attention,'due');assert.equal(out.items[3].attention,'in_progress');assert.equal(out.nextCursor,null);assert.deepEqual(f.writes,[]);
});
test('server filters complete scope and parents before stable 5+1 pagination and cursor binds original native identity/day',async()=>{
 const f=fixture(Array.from({length:13},(_,i)=>visit('v'+String(i).padStart(2,'0'),i<2?{windowStart:end}:{})));const one=await f.service.list(principal,'study');assert.equal(one.items.length,5);const c=JSON.parse(Buffer.from(one.nextCursor,'base64url'));assert.deepEqual(c,{schema:1,actor:'actor',authVersion:0,tenant:'tenant',studyId:'study',day,timeZone:'Asia/Shanghai',afterId:'v06'});
 const two=await f.service.list(principal,'study',{cursor:one.nextCursor});assert.deepEqual(two.items.map(x=>x.visitId),['v07','v08','v09','v10','v11']);const three=await f.service.list(principal,'study',{cursor:two.nextCursor});assert.equal(three.items.length,1);assert.equal(three.nextCursor,null);
 for(const name of ['subject','enrollment','visitPlan','protocolVersion'])for(const key of ['tenantId','studyGroupId','researchProjectId'])assert.equal(f.calls[0].where[name][key],scope[key]);
 for(const change of [{actor:'other'},{authVersion:1},{tenant:'other'},{studyId:'other'},{schema:2},{extra:true},{day:'2026-99-99'}])await assert.rejects(async()=>f.service.list(principal,'study',{cursor:Buffer.from(JSON.stringify({...c,...change})).toString('base64url')}),e=>e.status===400);
 f.time+=86400000;await assert.rejects(async()=>f.service.list(principal,'study',{cursor:one.nextCursor}),e=>e.status===409&&e.code==='DUE_VISIT_DAY_CHANGED');
});
test('all returned parents including limit+1 sentinel must agree on Subject and three Protocol IDs before any title/cursor is released',async()=>{
 for(const edit of [r=>r.enrollment.subjectId='other',r=>r.enrollment.protocolVersionId='other',r=>r.visitPlan.protocolVersionId='other',r=>r.protocolVersion.id='other']){
  const sentinel=visit('v5');edit(sentinel);const f=fixture([...Array.from({length:5},(_,i)=>visit('v'+i)),sentinel]);await assert.rejects(async()=>f.service.list(principal,'study'),e=>e.status===409&&e.code==='DUE_VISIT_BINDING_UNAVAILABLE');assert.deepEqual(f.writes,[]);
 }
});
test('invalid query fails without DB reads; native read denial is not an empty result and no write API is touched',async()=>{
 const f=fixture([visit('v1')]);for(const query of [{limit:5},{limit:'0'},{limit:'101'},{limit:'1.0'},{cursor:'***'},{cursor:''},{day:'2026-11-17'}])await assert.rejects(async()=>f.service.list(principal,'study',query),e=>e.status===400);assert.equal(f.calls.length,0);
 f.deny(Object.assign(Error('denied'),{status:403}));await assert.rejects(async()=>f.service.list(principal,'study'),e=>e.status===403);assert.equal(f.calls.length,0);assert.deepEqual(f.writes,[]);
});
