import test from'node:test';import assert from'node:assert/strict';import{seedRehearsalFoundation}from'./seed-rehearsal.mjs';
const args={runId:'rh-deploy-20261118-0fbba918',database:'rh_deploy_0fbba918',passwords:{admin:'a'.repeat(24),owner:'b'.repeat(24),invite:'c'.repeat(24)}};
test('synthetic foundation rejects an unowned database marker or an already populated database before any mutation',async()=>{
 let writes=0;const marker={purpose:'researchhub-deployment-rehearsal',syntheticOnly:true,runId:args.runId};let identity={name:args.database,role:'aisci_owner',marker:JSON.stringify(marker)},used=0;
 const tx={$queryRawUnsafe:async()=>[identity],tenant:{count:async()=>used,create:async()=>{writes++;}}},prisma={elevated:{$transaction:fn=>fn(tx)}};
 const deps={...args,prisma,load:()=>async()=>{},require:()=>({hash:async()=> 'not-a-password'})};
 for(const change of [{name:'clinical'},{role:'aisci_app'},{marker:JSON.stringify({...marker,syntheticOnly:false})},{marker:JSON.stringify({...marker,runId:'different'})}]){identity={name:args.database,role:'aisci_owner',marker:JSON.stringify(marker),...change};await assert.rejects(seedRehearsalFoundation(deps),/REHEARSAL_SEED_SCOPE_REJECTED/);}
 identity={name:args.database,role:'aisci_owner',marker:JSON.stringify(marker)};used=1;await assert.rejects(seedRehearsalFoundation(deps),/REHEARSAL_SEED_SCOPE_REJECTED/);assert.equal(writes,0);
});
