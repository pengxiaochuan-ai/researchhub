import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{commentParentProductionStatements}from'./comment-parent-production-ddl.mjs';
test('reply anchor revision is current at creation and frozen thereafter without blocking later withdrawal',()=>{
 const asset=JSON.parse(readFileSync(new URL('./fixtures/asset-production-baseline.json',import.meta.url))),constraints=JSON.parse(readFileSync(new URL('./fixtures/comment-parent-baseline.json',import.meta.url))),sql=commentParentProductionStatements(asset,constraints);
 assert.equal(sql.length,5);assert(sql[0].includes('c.revision=NEW.parent_revision'));assert(sql[0].includes("NEW.action<>'create' OR"));assert(sql[0].includes('business AND NEW.parent_revision IS DISTINCT FROM prior.parent_revision'));
 for(const statement of [sql[2],sql[4]]){assert(statement.includes('ELSE ('));assert(statement.includes('parent_revision IS NOT NULL AND parent_revision>0'));assert(statement.includes('parent_comment_id<>comment_id'));assert(statement.includes('parent_comment_id IS NULL AND parent_revision IS NULL'));}
 assert.throws(()=>commentParentProductionStatements(asset,constraints.slice(0,1)),/COMMENT_PARENT_SCHEMA_DRIFT/);
});
