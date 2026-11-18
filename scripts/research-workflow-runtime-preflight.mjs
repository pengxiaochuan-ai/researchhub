// Read-only reload gate for the owned, fixed-port synthetic runtime.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {workspaceRoot,fixtureEnvironment} from './research-creation-fixture.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
assert.deepEqual(process.argv.slice(2),['--local-synthetic']);
const env=fixtureEnvironment();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const runtime=JSON.parse(readFileSync(workspaceRoot+'.tmp/researchhub-knowledge-local/runtime.json'));
const activeLeases=await withFixtureTransaction(env,'direct',async tx=>{
 const tables=await tx.$queryRaw`SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name IN ('leaseExpiresAt','tenantId','status') GROUP BY table_name HAVING count(*)=3`;
 let total=0;for(const {table_name:table} of tables){assert(/^[a-z_]+$/.test(table));const [row]=await tx.$queryRawUnsafe('SELECT count(*)::int AS count FROM public.'+table+' WHERE "tenantId"=$1 AND "leaseExpiresAt">now() AND status NOT IN (\'completed\',\'failed\',\'succeeded\',\'cancelled\',\'canceled\',\'expired\')',runtime.ids.tenant);total+=row.count;}
 return total;
},{readOnly:true});
console.log(JSON.stringify({safeToReload:activeLeases===0,ownedPid:runtime.pid,activeLeases}));
assert.equal(activeLeases,0,'TARGET_HAS_INFLIGHT_LEASES');
