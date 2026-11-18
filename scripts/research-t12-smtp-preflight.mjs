// Explicit TLS/authentication check only. Does not send messages or import env.prod globally.
import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import {readStudyMailConfig,verifyStudySmtp} from '../server/research-capture/smtp-config.mjs';
assert.deepEqual(process.argv.slice(2),['--verify-smtp-config']);
const evidence=new URL('../docs/testing/evidence/research-t12-2026-11-12/',import.meta.url);
mkdirSync(evidence,{recursive:true});
let result;
try{
 const config=readStudyMailConfig({file:new URL('../env.prod',import.meta.url)});
 result={at:new Date().toISOString(),configured:true,...await verifyStudySmtp(config),emailSent:false,deliveryAccepted:false,businessAcceptance:false};
}catch{result={at:new Date().toISOString(),configured:false,verified:false,code:'STUDY_SMTP_CONFIG_INVALID',emailSent:false,deliveryAccepted:false,businessAcceptance:false};}
writeFileSync(new URL('smtp-preflight.json',evidence),JSON.stringify(result,null,2));
console.log(JSON.stringify(result));if(!result.verified)process.exitCode=1;
