import test from 'node:test';import assert from 'node:assert/strict';
import{receiptProductionStatements}from'./receipt-production-ddl.mjs';
test('portable receipts retain current identity, Hub, latest grant, lock order and precise audit filters',()=>{
 const [account,review,...acl]=receiptProductionStatements();
 for(const sql of [account,review]){assert(!sql.includes('__TENANT__'));assert(!sql.includes('__REVIEWER__'));assert(sql.includes("current_setting('app.account_id',true)"));assert(sql.includes("current_setting('app.auth_version',true)"));assert(sql.includes('FOR SHARE OF a,t,h'));assert(sql.includes('SECURITY DEFINER SET search_path = pg_catalog'));}
 assert(account.indexOf("'wp01:official'")<account.indexOf("'wp01:tenant:'"));assert(account.includes('LIMIT 2'));assert(account.includes("'targetAccountId'"));
 assert(review.includes('LOCK TABLE rh_source.review_grant_event IN SHARE MODE'));assert(review.includes('ORDER BY event_version DESC LIMIT 1'));assert(review.includes("IS DISTINCT FROM 'grant'"));assert(review.includes("a.meta->'input'->>'operationId'=p_operation"));assert(!review.includes("a.role='tenant_admin'"));
 assert.equal(acl.length,6);assert(acl.some(s=>s.includes('REVOKE ALL')));assert(acl.every(s=>!s.includes('TO PUBLIC')));
});
