import test from 'node:test';
import assert from 'node:assert/strict';
import {sendStudyInvitationEmail} from './delivery.mjs';
const config={host:'smtp.example.test',port:465,from:'study@example.test',user:'u',pass:'secret',secure:true};
const input={address:'recipient@example.test',invitationUrl:'https://research.example.test/h5/questionnaire/private-token'};
test('SMTP accepted is distinct from delivery and leaks neither address nor token',async()=>{
 let sent,closed=0;const result=await sendStudyInvitationEmail(config,input,{transportFactory:()=>({sendMail:async message=>(sent=message,{accepted:[input.address],rejected:[],messageId:'provider-1'}),close(){closed++;}})});
 assert.equal(result.status,'accepted');assert.match(result.providerMessageId,/^sha256:[a-f0-9]{64}$/);assert.equal(sent.to,input.address);assert.match(sent.text,/private-token/);assert.equal(closed,1);assert.doesNotMatch(JSON.stringify(result),/recipient|private-token|secret/);
});
test('rejection is explicit; transport interruption is unknown and not retried',async()=>{
 let calls=0,closed=0;const rejected=await sendStudyInvitationEmail(config,input,{transportFactory:()=>({sendMail:async()=>({accepted:[],rejected:[input.address]}),close(){closed++;}})});assert.deepEqual(rejected,{status:'rejected'});
 const unknown=await sendStudyInvitationEmail(config,input,{transportFactory:()=>({sendMail:async()=>{calls++;throw Object.assign(Error(input.address),{code:'ETIMEDOUT'});},close(){closed++;}})});assert.deepEqual(unknown,{status:'unknown'});assert.equal(calls,1);assert.equal(closed,2);assert.doesNotMatch(JSON.stringify(unknown),/recipient|private-token|secret/);
});
test('untrusted address and link fail before opening SMTP',async()=>{
 let calls=0;for(const bad of [{...input,address:'bad\r\nBcc:evil@example.test'},{...input,invitationUrl:'http://example.test/h5/questionnaire/token'}])await assert.rejects(sendStudyInvitationEmail(config,bad,{transportFactory:()=>{calls++;}}));assert.equal(calls,0);
});
test('abort closes the active transport and reports unknown without a retry',async()=>{
 let calls=0,closed=0;const controller=new AbortController();const pending=sendStudyInvitationEmail(config,input,{signal:controller.signal,transportFactory:()=>({sendMail:()=>{calls++;return new Promise(()=>{});},close(){closed++;}})});controller.abort();assert.deepEqual(await pending,{status:'unknown'});assert.equal(calls,1);assert.equal(closed,1);
});
test('loopback invitation explains that the synthetic test link opens only on this computer',async()=>{
 let message;await sendStudyInvitationEmail(config,{...input,invitationUrl:'http://127.0.0.1:19501/h5/questionnaire/private-token'},{transportFactory:()=>({sendMail:async m=>(message=m,{accepted:[input.address],messageId:'test-local'}),close(){}})});
 assert.match(message.subject,/合成测试/);assert.match(message.text,/仅可在运行岐研的本机打开/);
});
