import {test} from 'node:test';
import assert from 'node:assert/strict';
const api=await import('./research-assets-detail-schema.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return{};});
const ids=Object.fromEntries(['tenant','group','project','owner','admin'].map(k=>[k,'rh-kb-local-b0e2af9d-'+k]));
import {catalogSchemaDisposition,CATALOG_TABLES} from './research-assets-catalog-schema.mjs';
test('six tables without a verified D02 receipt are drift, never a new baseline',()=>{
 const state={exists:true,tables:[...CATALOG_TABLES,'asset_comment_event','asset_reuse_record'],comment:'rh_asset_schema.v1:sha'};
 assert.throws(()=>catalogSchemaDisposition(state,'sha'),/DRIFT/);
 assert.equal(catalogSchemaDisposition(state,'sha',{detailExtensionVerified:true}),'verified');
 assert.throws(()=>catalogSchemaDisposition({...state,tables:[...state.tables,'unapproved']},'sha',{detailExtensionVerified:true}),/DRIFT/);
});
test('migration actor must still be an actual current tenant administrator',()=>{
 assert.equal(typeof api.assertDetailMigrationActor,'function');api.assertDetailMigrationActor({role:'tenant_admin',authVersion:5});
 for(const v of [null,{role:'researcher',authVersion:5},{role:'admin',authVersion:5},{role:'tenant_admin',authVersion:-1}])assert.throws(()=>api.assertDetailMigrationActor(v),/ADMIN_REQUIRED/);
});
test('D02 only targets owned tables/functions and keeps old migration immutable',()=>{
 assert.equal(typeof api.detailSchemaStatements,'function');const sql=api.detailSchemaStatements(ids).join('\n');
 assert(sql.includes('CREATE TABLE rh_asset.asset_comment_event'));assert(sql.includes('CREATE TABLE rh_asset.asset_reuse_record'));assert(sql.includes('FORCE ROW LEVEL SECURITY'));
 assert(!/\b(?:ALTER TABLE|GRANT[^;]+ON)\s+public\./i.test(sql));assert(!/SECURITY DEFINER|GRANT ALL|ALTER ROLE|TRUNCATE/i.test(sql));
 assert(sql.includes('rh-research-asset:catalog-20261112:'));assert(sql.includes('rh-research-asset:detail-20261113:'));
 assert.equal((sql.match(/DROP CONSTRAINT/g)??[]).length,1);assert(!/DROP CONSTRAINT[^\n]*(?:revision|version)/.test(sql));
 assert(!sql.includes("'commented'"));assert(!sql.includes("'applied'"));
});
