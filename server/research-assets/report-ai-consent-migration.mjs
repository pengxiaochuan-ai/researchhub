import {readFileSync} from 'node:fs';
import {assetDigest} from '../../scripts/research-assets-registration-contract.mjs';
// Preparation only: no DB connection, execution, auto-migration or role change.
export const REPORT_AI_CONSENT_SCHEMA_HASH='d792904471fc057d799ba72df622b1f98dd4a6f3d55ddfe76027994c7f9503c4';
export function prepareReportAiConsentMigration({schemaExists,tableExists,sql=readFileSync(new URL('./report-ai-consent-schema.sql',import.meta.url),'utf8')}){
 if(schemaExists!==true||tableExists!==false)throw Error('REPORT_AI_CONSENT_SCHEMA_REVIEW_REQUIRED');
 const statements=sql.split(/^-- @statement\s*$/m).map(s=>s.split('\n').filter(l=>!l.trim().startsWith('--')).join('\n').trim()).filter(Boolean);
 const heads=[/^CREATE TABLE rh_asset\.ai_use_consent_event \(/,/^ALTER TABLE rh_asset\.ai_use_consent_event ADD CONSTRAINT report_ai_local_admission CHECK \(/,/^CREATE FUNCTION rh_asset\.check_ai_consent_event\(\)/,/^REVOKE ALL ON FUNCTION rh_asset\.check_ai_consent_event\(\) FROM PUBLIC;$/,/^CREATE TRIGGER check_ai_consent_event BEFORE INSERT ON rh_asset\.ai_use_consent_event /,/^CREATE TRIGGER immutable_ai_consent_event BEFORE UPDATE OR DELETE ON rh_asset\.ai_use_consent_event /,/^ALTER TABLE rh_asset\.ai_use_consent_event ENABLE ROW LEVEL SECURITY;$/,/^ALTER TABLE rh_asset\.ai_use_consent_event FORCE ROW LEVEL SECURITY;$/,/^CREATE POLICY ai_consent_select ON rh_asset\.ai_use_consent_event /,/^CREATE POLICY ai_consent_insert ON rh_asset\.ai_use_consent_event /,/^CREATE INDEX ai_consent_latest ON rh_asset\.ai_use_consent_event\(/,/^REVOKE ALL ON rh_asset\.ai_use_consent_event FROM PUBLIC;$/,/^GRANT SELECT,INSERT ON rh_asset\.ai_use_consent_event TO aisci_app;$/];
 if(assetDigest(sql)!==REPORT_AI_CONSENT_SCHEMA_HASH||statements.length!==heads.length||statements.some((s,i)=>!heads[i].test(s)))throw Error('REPORT_AI_CONSENT_MIGRATION_REJECTED');
 return{statements,schemaHash:REPORT_AI_CONSENT_SCHEMA_HASH,requiresExplicitApproval:true,objects:{tables:1,functions:1,triggers:2,policies:2,indexes:1,localAdmissionConstraints:1},permissions:'SELECT,INSERT on rh_asset.ai_use_consent_event'};
}
