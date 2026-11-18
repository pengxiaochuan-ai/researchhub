import test from 'node:test';import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {loadFixtureInput} from '../../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction} from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import {inspectReferenceSchema} from '../../scripts/reference-divisions-schema.mjs';
import {listDivisions,resolveLocation,DATASET_VERSION} from './divisions.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url)),{env}=loadFixtureInput(root+'.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json');
test('real synthetic PG dictionary receipt and content match, application can read the full source-backed selection',async()=>{
 assert.equal(await inspectReferenceSchema(env),'existing');
 await withFixtureTransaction(env,'app',async tx=>{assert.equal((await listDivisions(tx)).items.length,34);assert((await listDivisions(tx,'410000')).items.some(x=>x.name==='济源市'));assert.equal((await resolveLocation(tx,{version:DATASET_VERSION,provinceCode:'110000',cityCode:'110000'})).city,'北京市');},{readOnly:true});
});
test('application has only SELECT and cannot write the shared dictionary',async()=>{
 const p=await withFixtureTransaction(env,'app',async tx=>(await tx.$queryRaw`SELECT has_table_privilege(current_user,'rh_reference.administrative_division','SELECT') AS read,has_table_privilege(current_user,'rh_reference.administrative_division','INSERT') AS insert,has_table_privilege(current_user,'rh_reference.administrative_division','UPDATE') AS update,has_table_privilege(current_user,'rh_reference.administrative_division','DELETE') AS delete`)[0],{readOnly:true});
 assert.deepEqual(p,{read:true,insert:false,update:false,delete:false});
 const columns=await withFixtureTransaction(env,'direct',tx=>tx.$queryRaw`SELECT a.attname,has_column_privilege('aisci_app',c.oid,a.attnum,'UPDATE') AS update,has_column_privilege('aisci_app',c.oid,a.attnum,'INSERT') AS insert,has_column_privilege('aisci_app',c.oid,a.attnum,'REFERENCES') AS references FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rh_reference' AND c.relname='administrative_division' AND a.attnum>0 AND NOT a.attisdropped`,{readOnly:true});assert.equal(columns.length,8);assert(columns.every(c=>!c.update&&!c.insert&&!c.references));
 await assert.rejects(()=>withFixtureTransaction(env,'app',tx=>tx.$executeRaw`UPDATE rh_reference.administrative_division SET name=name WHERE code='110000'`),e=>e.meta?.code==='42501'||/permission denied/.test(e.message));
});
