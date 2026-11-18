import test from 'node:test';import assert from 'node:assert/strict';
import {accessGuardStatements} from './research-assets-access-schema.mjs';
test('C05 guard upgrade only replaces owned guards and attaches the access constraint, no public DDL or new role grants',()=>{
 const ids=Object.fromEntries(['tenant','group','project','owner','admin'].map(k=>[k,'rh-kb-local-test-'+k]));const sql=accessGuardStatements(ids).join('\n');
 assert(sql.includes('CREATE OR REPLACE FUNCTION rh_asset.check_registry_parent'));assert(sql.includes('CREATE OR REPLACE FUNCTION rh_asset.check_registry_event'));
 assert(sql.includes('access_event_commit'));assert(sql.includes('ASSET_RECIPIENT_MUTATION_INVALID'));assert(sql.includes('ASSET_ACCESS_EVENT_INVALID'));
 assert(!/CREATE TABLE|ALTER ROLE|GRANT |DROP |SECURITY DEFINER/.test(sql));assert(!/CREATE OR REPLACE FUNCTION public\./.test(sql));
 assert.throws(()=>accessGuardStatements({...ids,admin:'unsafe'}),/SCOPE/);
});
