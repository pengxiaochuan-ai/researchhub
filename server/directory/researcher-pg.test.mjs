import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createDirectoryService} from './commands.mjs';import {directoryRollback} from './test-support.mjs';
test('real PG reviewed team lead is readable by researcher ID with current-source fences and no private account fields',async()=>directoryRollback(async({db,ctx,provenance,suffix,direct,sourceId,rowId})=>{
 const s=createDirectoryService({db}),admin=ctx('admin'),name='研究者回滚核验-'+suffix;
 const organization={name:'研究者关联机构-'+suffix};
 const c=await s.createTeamWorkspace(admin,{data:{name:'研究者关联团队-'+suffix,organization,members:[{key:'lead',name,rank:'教授',role:'lead',organization}],evidence:[{reference:provenance[0],targets:['team','organization','member:lead','member-organization:lead']}]},requestKey:randomUUID()});
 const preview=await s.previewTeamWorkspace(admin,c.id,'tenant');assert.equal(preview.canApprove,true,JSON.stringify(preview.issues));
 await s.reviewTeamWorkspace(admin,c.id,{expectedVersion:1,planHash:preview.planHash,audience:'tenant',reason:'事务回滚合成验证',requestKey:randomUUID()});
 const w=await s.teamWorkspace(admin,c.id),id=w.data.members[0].entityId;
 const list=await s.researchers(ctx('owner'),{q:name,rank:'教授'},'tenant');assert.equal(list.pagination.totalItems,1);assert.equal(list.items[0].id,id);assert.equal(list.items[0].teams[0].id,c.id);
 const facets=await s.researcherFacets(ctx('owner'),{q:name},'tenant');assert.equal(facets.facets.rank[0].value,'教授');
 const detail=await s.researcher(ctx('owner'),id,'tenant');assert.equal(detail.item.name,name);assert.equal(detail.item.teams[0].id,c.id);assert.equal(detail.item.affiliations[0].name,w.data.organization.name);assert(detail.item.provenance.some(p=>p.label?.includes('团队')));assert(!JSON.stringify(detail).includes('accountId'));assert(!JSON.stringify(detail).includes('example.org'));
 assert.equal(list.items[0].primaryTeam,null);
 assert.equal((await s.researchers({},{q:name},'public')).pagination.totalItems,0);await assert.rejects(()=>s.researcher({},id,'public'),{status:404});
 await assert.rejects(()=>s.researchers({}, {},'tenant'),{status:401});await assert.rejects(()=>s.researcherRelations(ctx('owner'),id,'members',1,'tenant'),{status:400});
 assert.equal((await s.researcherRelations(ctx('owner'),id,'teams',1,'tenant')).items[0].id,c.id);
 for(const fact of [{assertionKey:'affiliation:history',kind:'affiliation',relatedEntityId:w.data.organization.entityId,payload:{current:false,isPrimaryForDisplay:false,startMonth:'2019-01',endMonth:'2020-12'}},{assertionKey:'collaboration:organization',kind:'collaboration',relatedEntityId:w.data.organization.entityId,payload:{current:true,collaborationType:'具名合成合作',description:'仅回滚测试'}}]){const a=await s.appendAssertion(admin,id,{...fact,expectedRevision:0,provenance,requestKey:randomUUID()});await s.decide(admin,a.id,{expectedDecisionVersion:0,assertionHash:a.hash,decision:'approve',audience:'tenant',reason:'回滚关系依据核验',requestKey:randomUUID()});}
 const related=await s.researcher(ctx('owner'),id,'tenant');assert.equal(related.item.affiliationHistory.length,1);assert.equal(related.item.collaborations.length,1);assert(related.item.provenance.some(p=>p.label?.startsWith('合作关系')));assert.equal(related.item.provenance.filter(p=>p.label?.startsWith('任职关系')).length,2);
 await assert.rejects(()=>s.researcher({...ctx('owner'),user:{...ctx('owner').user,authVersion:-1}},id,'tenant'),{status:401});
 await direct(tx=>tx.$executeRaw`INSERT INTO rh_source.review_decision(tenant_id,hub_key,source_registry_id,source_record_id,field_kind,purpose,audience,decision,evidence_ref,reviewer_id,confirmed_count) VALUES(${db.tenantId},${db.hubKey},${sourceId},${rowId},'abstract','display','public','revoke','evidence://researcher-source-revoke',${admin.user.accountId},1)`);
 await assert.rejects(()=>s.researcher(ctx('owner'),id,'tenant'),{status:404});assert.equal((await s.researchers(ctx('owner'),{q:name},'tenant')).pagination.totalItems,0);
}));
