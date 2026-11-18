import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
test('preservation_requires_explicit_synthetic_mode_before_reading_config',()=>{
 const result=spawnSync(process.execPath,['scripts/asset-applicability-preservation.mjs','baseline'],{encoding:'utf8',cwd:new URL('..',import.meta.url)});
 assert.notEqual(result.status,0);assert.match(result.stderr,/WP09_SYNTHETIC_MODE_REQUIRED/);
});
