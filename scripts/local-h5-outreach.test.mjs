import test from 'node:test';import assert from 'node:assert/strict';import {createLocalH5Outreach} from './local-h5-outreach.mjs';
test('fixture adapter denies cross-tenant invitation and session lookups before service use',async()=>{
 let tenant='local';const tx={questionnaireInvitation:{findUnique:async()=>({tenantId:tenant})},questionnaireSession:{findUnique:async()=>({tenantId:tenant})},tenantFeatureEntitlement:{findFirst:async({where})=>where.tenantId==='local'?{enabled:true}:null}};
 class Service{constructor(prisma,features){this.prisma=prisma;this.features=features;}}const service=createLocalH5Outreach({ids:{tenant:'local'},direct:fn=>fn(tx),load:()=>Service});
 assert.equal((await service.prisma.elevated.$transaction(t=>t.questionnaireInvitation.findUnique({}))).tenantId,'local');assert.equal((await service.prisma.elevated.$transaction(t=>t.questionnaireSession.findUnique({}))).tenantId,'local');tenant='other';
 assert.equal(await service.prisma.elevated.$transaction(t=>t.questionnaireInvitation.findUnique({})),null);assert.equal(await service.prisma.elevated.$transaction(t=>t.questionnaireSession.findUnique({})),null);await assert.rejects(service.features.assertEnabled('other','participant_h5'));await service.features.assertEnabled('local','participant_h5');
});
