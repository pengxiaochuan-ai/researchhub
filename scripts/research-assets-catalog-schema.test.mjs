import test from 'node:test';
import assert from 'node:assert/strict';
import {assetSchemaStatements,catalogSchemaDisposition} from './research-assets-catalog-schema.mjs';
const ids=Object.fromEntries(['tenant','group','project','owner','admin'].map(k=>[k,'rh-kb-local-test-'+k]));

test('migration renderer refuses unsafe or unbound target identities before producing SQL',()=>{
 assert.throws(()=>assetSchemaStatements(ids,'CREATE TABLE public.account(id text)'),/SCHEMA/);
 assert.throws(()=>assetSchemaStatements({...ids,tenant:"bad';GRANT ALL"},'CREATE SCHEMA rh_asset'),/SCOPE/);
 assert.throws(()=>assetSchemaStatements({...ids,admin:ids.owner},'CREATE SCHEMA rh_asset'),/SCOPE/);
 assert.throws(()=>assetSchemaStatements(ids,'GRANT ALL ON SCHEMA public TO aisci_app'),/SCHEMA/);
 assert.throws(()=>assetSchemaStatements(ids,'CREATE SCHEMA rh_asset\n-- statement\nDROP TABLE public.account'),/SCHEMA/);
 const sql=assetSchemaStatements(ids,"CREATE SCHEMA rh_asset\n-- statement\nCREATE FUNCTION rh_asset.example() RETURNS text LANGUAGE sql AS $$ SELECT '{{TENANT_ID}}'::text $$");
 assert.equal(sql.length,2);assert.match(sql[1],/SELECT 'rh-kb-local-test-tenant'::text/);assert.doesNotMatch(sql[1],/\{\{/);
});

test('schema disposition never repairs partial or drifted namespaces and only skips exact owned revision',()=>{
 assert.equal(catalogSchemaDisposition({exists:false,tables:[],comment:null},'sha'),'create');
 assert.equal(catalogSchemaDisposition({exists:true,tables:['asset_registry','version_policy','access_request','asset_event'],comment:'rh_asset_schema.v1:sha'},'sha'),'verified');
 for(const state of [{exists:true,tables:[],comment:null},{exists:true,tables:['asset_registry'],comment:'rh_asset_schema.v1:sha'},{exists:true,tables:['asset_registry','version_policy','access_request','asset_event'],comment:'different'}])assert.throws(()=>catalogSchemaDisposition(state,'sha'),/DRIFT/);
});
