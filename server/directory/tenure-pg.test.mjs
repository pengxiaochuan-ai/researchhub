import test from 'node:test';import assert from 'node:assert/strict';import{randomUUID}from'node:crypto';
import{directoryRollback}from'./test-support.mjs';import{createDirectoryService}from'./commands.mjs';
test('real PG approved current month reaches list and detail; pending revision cannot expose a replacement month',async()=>directoryRollback(async({db,ctx,provenance,suffix})=>{
 const s=createDirectoryService({db}),admin=ctx('admin');
 const create=async(kind,name)=>{const e=await s.createEntity(admin,{kind,stableKey:'tenure-'+kind+'-'+suffix,requestKey:randomUUID()}),a=await s.appendAssertion(admin,e.id,{kind:'profile',assertionKey:'profile',expectedRevision:0,payload:{name,directions:[]},provenance,requestKey:randomUUID()});await s.decide(admin,a.id,{expectedDecisionVersion:0,assertionHash:a.hash,decision:'approve',audience:'tenant',reason:'仅事务回滚任职日期核验',requestKey:randomUUID()});return e;};
 const org=await create('organization','合成月份机构-'+suffix),person=await create('researcher','合成月份研究者-'+suffix),payload={startMonth:'2021-03',endMonth:null,current:true,isPrimaryForDisplay:true};
 const a=await s.appendAssertion(admin,person.id,{kind:'affiliation',assertionKey:'affiliation:'+org.id,relatedEntityId:org.id,expectedRevision:0,payload,provenance,requestKey:randomUUID()});await s.decide(admin,a.id,{expectedDecisionVersion:0,assertionHash:a.hash,decision:'approve',audience:'tenant',reason:'仅事务回滚任职日期核验',requestKey:randomUUID()});
 const item=(await s.researcher(ctx('owner'),person.id,'tenant')).item;assert.equal(item.affiliations[0].startMonth,'2021-03');assert.equal(item.affiliations[0].current,true);assert.equal((await s.researchers(ctx('owner'),{q:'合成月份研究者-'+suffix},'tenant')).items[0].affiliations[0].startMonth,'2021-03');
 await s.appendAssertion(admin,person.id,{kind:'affiliation',assertionKey:'affiliation:'+org.id,relatedEntityId:org.id,expectedRevision:1,payload:{...payload,startMonth:'2024-08'},provenance,requestKey:randomUUID()});
 assert.deepEqual((await s.researcher(ctx('owner'),person.id,'tenant')).item.affiliations,[]);
}));
