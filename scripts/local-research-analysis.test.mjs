import test from 'node:test';import assert from 'node:assert/strict';import {extendLocalMethodPrisma} from './local-research-analysis.mjs';
test('method reads always enter their exact tenant transaction and unknown models fail closed',async()=>{
 const calls=[],prisma=extendLocalMethodPrisma({withTenantTransaction:async(t,g,p,fn)=>{calls.push([t,g,p]);return fn({agent:{findMany:async args=>args},tenantFeatureEntitlement:{findFirst:async args=>args}});}},'tenant');
 assert.deepEqual(await prisma.forTenant('tenant','group','project').agent.findMany({where:{status:'active'}}),{where:{status:'active'}});assert.deepEqual(calls,[['tenant','group','project']]);
 await prisma.forTenant('tenant').tenantFeatureEntitlement.findFirst({where:{enabled:true}});assert.deepEqual(calls[1],['tenant',undefined,undefined]);
 assert.throws(()=>prisma.forTenant('foreign','group','project'));assert.throws(()=>prisma.forTenant('tenant').agent);assert.throws(()=>prisma.forTenant('tenant','group','project').account);assert.throws(()=>prisma.forTenant('tenant','group','project').agent.deleteMany);
});
