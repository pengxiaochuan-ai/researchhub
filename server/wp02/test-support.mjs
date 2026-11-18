import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';import {readFileSync} from 'node:fs';
import {loadFixtureInput} from '../../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction} from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import {createWp02Repository} from './repository.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url)),require=createRequire(root+'app/server/package.json');
require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});
export const bcrypt=require('bcryptjs');
export const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json'));
export const fixture=JSON.parse(readFileSync(root+'.tmp/researchhub-wp02/invitation-fixture.json'));
export const {env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
export const direct=fn=>withFixtureTransaction(env,'direct',fn);
const {lockAuthorizationMutation}=require(root+'app/server/src/common/worker-publication.ts');
export const db=createWp02Repository({tenantId:runtime.ids.tenant,transact:direct,lockAuthorization:lockAuthorizationMutation});
export async function withRollback(testBody){const rollback=new Error('WP02_TEST_ROLLBACK');try{await direct(async tx=>{let n=0;const isolated=createWp02Repository({tenantId:runtime.ids.tenant,transact:async fn=>{const sp='wp02_test_'+(++n);await tx.$executeRawUnsafe('SAVEPOINT '+sp);try{const result=await fn(tx);await tx.$executeRawUnsafe('RELEASE SAVEPOINT '+sp);return result;}catch(e){await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT '+sp);throw e;}},lockAuthorization:lockAuthorizationMutation});await testBody({db:isolated,direct:fn=>fn(tx)});throw rollback;});}catch(e){if(e!==rollback)throw e;}}
