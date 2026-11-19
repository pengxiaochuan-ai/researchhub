import test from 'node:test';import assert from 'node:assert/strict';
import {demoIdentifier,demoSelection,assertDemoSourceIdentity,assertDemoSourceEndpoint} from './demo-snapshot-plan.mjs';
test('schema dump and row export must bind the same loopback5434 synthetic database',()=>{
 const value='postgresql://aisci_owner:synthetic@127.0.0.1:5434/wp01_test_full_baseline';
 assert.doesNotThrow(()=>assertDemoSourceEndpoint(value));
 for(const changed of [value.replace('127.0.0.1','remote.example'),value.replace(':5434',':5432'),value.replace('wp01_test_full_baseline','aisci'),value.replace('aisci_owner','postgres')])assert.throws(()=>assertDemoSourceEndpoint(changed),/ENDPOINT_REJECTED/);
});
test('ordinary rows bind an explicit tenant parameter and unknown global tables fail closed',()=>{
 assert.equal(demoSelection({schema:'public',name:'account',columns:['id','tenantId']}),'"t"."tenantId"=$1');
 assert.equal(demoSelection({schema:'rh_asset',name:'asset_registry',columns:['tenant_id']}),'"t"."tenant_id"=$1');
 assert.throws(()=>demoSelection({schema:'public',name:'new_global',columns:['id']}),/UNSCOPED/);
 assert.throws(()=>demoSelection({schema:'wp01_meta',name:'fixture_run',columns:['tenant_id']}),/TABLE_REJECTED/);
 assert.throws(()=>demoIdentifier('account; DROP TABLE account'),/IDENTIFIER/);
});
test('only four named exceptions have explicit global or inherited scope',()=>{
 assert.equal(demoSelection({schema:'public',name:'tenant',columns:['id']}),'"t".id=$1');
 assert.equal(demoSelection({schema:'public',name:'_prisma_migrations',columns:[]}),'TRUE');
 assert.equal(demoSelection({schema:'rh_reference',name:'administrative_division',columns:[]}),'TRUE');
 assert.match(demoSelection({schema:'public',name:'scale_item',columns:['scaleId']}),/demo_scale\."tenantId"=\$1/);
});
test('a read-write, clinical, wrong-role or wrong-marker connection cannot be the source',()=>{
 const id={database:'wp01_test_full_baseline',role:'aisci_owner',readonly:'on',marker:JSON.stringify({purpose:'wp01-shared-boundary',syntheticOnly:true,runId:'fixed-run'})};
 assert.doesNotThrow(()=>assertDemoSourceIdentity(id,'fixed-run'));
 for(const patch of [{database:'aisci'},{role:'postgres'},{readonly:'off'},{marker:'{}'},{marker:JSON.stringify({purpose:'wp01-shared-boundary',syntheticOnly:false,runId:'fixed-run'})}])assert.throws(()=>assertDemoSourceIdentity({...id,...patch},'fixed-run'),/SOURCE_REJECTED/);
 assert.throws(()=>assertDemoSourceIdentity(id,'different-run'),/SOURCE_REJECTED/);
});
