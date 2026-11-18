// Explicit invocation only; guarded dedicated synthetic target, read-only.
import assert from 'node:assert/strict';
import {executeCatalogSchema} from '../../scripts/research-assets-catalog-schema.mjs';
const result=await executeCatalogSchema();
assert.equal(result.syntheticOnly,true);
assert(['not_applied','verified'].includes(result.action));
assert.equal(result.protectedSnapshot.oldAssetCount,10);
assert.equal(result.protectedSnapshot.oldVersionCount,20);
console.log(JSON.stringify(result,null,2));
