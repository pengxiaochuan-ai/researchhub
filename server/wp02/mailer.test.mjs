import test from 'node:test';
import assert from 'node:assert/strict';
import {createAccountMailer} from './mailer.mjs';
const config={mode:'capture',baseUrl:'http://127.0.0.1:19501',from:'researchhub@example.test',smtpHost:'127.0.0.1',smtpPort:19506};
const mail={purpose:'register',to:'recipient@example.test',tokenUrl:'http://127.0.0.1:19501/pages/p004/#verify='+'a'.repeat(43),expiresAt:new Date(Date.now()+60000)};
test('transport is loopback only and SMTP acceptance without matching receipt is unknown',async()=>{
 let sent;const m=createAccountMailer({...config,SMTP_HOST:'remote.invalid'},{transportFactory:options=>{assert.equal(options.host,'127.0.0.1');assert.equal(options.auth,undefined);assert.equal(options.logger,false);return{sendMail:async value=>{sent=value;return{accepted:[mail.to]};}};},receipt:()=>null});
 assert.equal((await m.send(mail)).status,'unknown');assert.equal(sent.disableFileAccess,true);assert.equal(sent.disableUrlAccess,true);
});
test('rejects foreign email/link, wrong purpose and invalid expiry before sending',async()=>{
 let calls=0;const m=createAccountMailer(config,{transportFactory:()=>({sendMail:async()=>{calls++;}}),receipt:()=>null});
 for(const patch of [{to:'outside@external.invalid'},{tokenUrl:'https://evil.invalid/#token'},{purpose:'reset'},{expiresAt:new Date(0)}])await assert.rejects(m.send({...mail,...patch}));
 assert.equal(calls,0);
});
test('SMTP refusal is failed but ambiguous transport failure is unknown, never retried',async()=>{
 for(const [code,status] of [['EENVELOPE','failed'],['ECONNECTION','failed'],['ETIMEDOUT','unknown']]){let calls=0;const m=createAccountMailer(config,{transportFactory:()=>({sendMail:async()=>{calls++;throw Object.assign(new Error('unlogged'),{code});}}),receipt:()=>null});assert.equal((await m.send(mail)).status,status);assert.equal(calls,1);}
});
