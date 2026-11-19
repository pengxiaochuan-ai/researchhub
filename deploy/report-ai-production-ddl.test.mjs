import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
import{reportAiProductionStatements}from'./report-ai-production-ddl.mjs';
test('material evidence is append-only, reviewer controlled, current, source-bound, audited and not a caller boolean',()=>{
 const snapshot=JSON.parse(readFileSync(new URL('./fixtures/report-ai-production-baseline.json',import.meta.url))),[basis,drop,check,fn]=reportAiProductionStatements(snapshot);
 for(const value of ['FORCE ROW LEVEL SECURITY','GRANT SELECT,INSERT',"'artifact.review'",'MATERIAL_AI_REVISION_CONFLICT','MATERIAL_AI_BINDING_IMMUTABLE','MATERIAL_AI_SOURCE_INVALID','MATERIAL_AI_AUDIT_REQUIRED','e.revision=(SELECT max(n.revision)',"a.status='released'",'previous_event_id'])assert(basis.includes(value),value);
 assert(!/GRANT[^;]*(?:UPDATE|DELETE)/.test(basis));assert(check.includes('ELSE ('));assert(check.includes('aq-c2-user-20261117'));assert(check.includes("interval '7 days'"));
 assert(basis.includes('VOLATILE SECURITY INVOKER'));assert(!basis.includes('statement_timestamp()'));assert(basis.includes('e.expires_at>clock_timestamp()'));
 assert(basis.indexOf("'wp01:official'")<basis.indexOf("'wp01:tenant:'"));assert(basis.indexOf("'wp01:tenant:'")<basis.indexOf("'rh-material-ai:'"));assert(fn.includes('NEW.expires_at<=clock_timestamp()'));
 assert(fn.includes('material_basis_matches'));assert(fn.includes('av."artifactId"=NEW.asset_id'));assert(fn.includes('REPORT_AI_CONSENT_REVOKE_BINDING_CHANGED'));assert(fn.includes("a.status='released'"));assert(fn.includes('REPORT_AI_CONSENT_AUDIT_REQUIRED'));
 assert.throws(()=>reportAiProductionStatements({...snapshot,function:snapshot.function.replace(' PERFORM pg_advisory_xact_lock',' changed')}),/REPORT_AI_PRODUCTION_SCHEMA_DRIFT/);
});
