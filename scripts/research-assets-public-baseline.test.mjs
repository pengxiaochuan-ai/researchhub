import test from 'node:test';import assert from 'node:assert/strict';
import {approvedReceiptDefinition,assertApprovedReceiptRow,verifyAssetPublicBaseline} from './research-assets-public-baseline.mjs';
const tenant='rh-kb-local-b0e2af9d-tenant',row={definition:{sql:approvedReceiptDefinition(tenant),acl:'{aisci_owner=X/aisci_owner,aisci_app=X/aisci_owner}'}};
test('only exact approved function SQL and exact grants may be separated from the old proof',()=>{
 assert.doesNotThrow(()=>assertApprovedReceiptRow(row,tenant));
 for(const change of [{sql:row.definition.sql+' '},{sql:row.definition.sql.replace('SECURITY DEFINER','SECURITY INVOKER')},{acl:'{=X/aisci_owner,aisci_owner=X/aisci_owner,aisci_app=X/aisci_owner}'},{acl:'{aisci_owner=X/aisci_owner}'},{acl:null}])assert.throws(()=>assertApprovedReceiptRow({definition:{...row.definition,...change}},tenant),/DRIFT/);
 assert.throws(()=>approvedReceiptDefinition('other'),/SOURCE_DRIFT/);
});
test('missing approved function cannot make the validation helper install it',async()=>{
 let writes=0;const tx={$queryRawUnsafe:async()=>[{database:'wp01_test_full_baseline',owner:'aisci_owner',app_create:false,app_owner_member:false}],$queryRaw:async()=>[],$executeRawUnsafe:async()=>{writes++;}};
 await assert.rejects(verifyAssetPublicBaseline(tx,{tenantId:tenant,expectedHash:'unused'}),/CATALOG_BASELINE_NO_DDL/);assert.equal(writes,0);
});
