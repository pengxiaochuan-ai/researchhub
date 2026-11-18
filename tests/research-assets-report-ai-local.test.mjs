import test from'node:test';import assert from'node:assert/strict';
import{REPORT_AI_LOCAL,assertReportAiLocalTarget,assertReportAiLocalEvent}from'../server/research-assets/report-ai-local.mjs';
const l=REPORT_AI_LOCAL,start='2026-11-17T04:00:00Z',expiry='2026-11-24T04:00:00Z',first={...l,revision:1,eventKind:'grant',startsAt:start,expiresAt:expiry};
test('source admission and consent candidate bind the exact newly approved C2 v2, not a same-source copy',()=>{
 assert.doesNotThrow(()=>assertReportAiLocalTarget(l));
 for(const patch of [{assetId:'other-copy'},{assetVersion:1},{artifactVersionId:'other-v'},{policyHash:'0'.repeat(64)},{accountId:'owner'},{materialBasisHash:'0'.repeat(64)}])assert.throws(()=>assertReportAiLocalTarget({...l,...patch}));
});
test('only the proposed three named events fit the first seven-day window, never arbitrary renewal or longer grants',()=>{
 assert.doesNotThrow(()=>assertReportAiLocalEvent(first,null));
 const revoked={...first,revision:2,eventKind:'revoke'},again={...first,revision:3};assert.doesNotThrow(()=>assertReportAiLocalEvent(revoked,first));assert.doesNotThrow(()=>assertReportAiLocalEvent(again,revoked));
 for(const [value,prior]of [[{...first,expiresAt:'2026-12-17T04:00:00Z'},null],[{...first,revision:2},first],[{...again,expiresAt:'2026-11-25T04:00:00Z'},revoked],[{...again,revision:4},again],[{...revoked,accountId:'owner'},first]])assert.throws(()=>assertReportAiLocalEvent(value,prior));
});
