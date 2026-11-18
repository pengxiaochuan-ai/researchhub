import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import nodemailer from 'nodemailer';
import {startCapture} from '../wp02/capture.mjs';
import {createSimulationStudyMailer} from './delivery.mjs';
const targets=[{studyId:'study',caseId:'rh-full-study-abc-case'}],message={studyId:'study',address:'rh-full-study-abc-s1@example.test',invitationUrl:'http://127.0.0.1:19501/h5/questionnaire/SyntheticOnlyToken'};
test('case-bound invitation actually passes the existing loopback SMTP capture protocol and digest receipt',async()=>{
 const base=fileURLToPath(new URL('../../../.tmp/full-study-tests/',import.meta.url));mkdirSync(base,{recursive:true,mode:0o700});const dir=mkdtempSync(base+'smtp-');
 const capture=await startCapture({mode:'capture',smtpHost:'127.0.0.1',inboxHost:'127.0.0.1',smtpPort:0,inboxPort:0},{dir});
 try{let used;const mailer=createSimulationStudyMailer({targets,receipt:id=>capture.receipt(id),transportFactory:options=>{used=options;return nodemailer.createTransport({...options,port:capture.sendPort});}});
 const value=await mailer(message);assert.equal(value.status,'accepted');assert.equal(capture.receipt(value.providerMessageId)?.to,message.address);assert.equal(used.host,'127.0.0.1');assert.equal(used.port,19506);
 }finally{await capture.close();rmSync(dir,{recursive:true,force:true});}
});
test('target rejects real or unrelated synthetic addresses before transport; other studies keep their channel',async()=>{
 let transports=0,ordinary=0;const mailer=createSimulationStudyMailer({targets,original:async()=>{ordinary++;return{status:'original'};},transportFactory:()=>{transports++;throw Error('unexpected');}});
 await assert.rejects(mailer({...message,address:'jerry_shi@live.cn'}),/SIMULATION_LOCAL_RECIPIENT_REQUIRED/);
 await assert.rejects(mailer({...message,address:'other@example.test'}),/SIMULATION_LOCAL_RECIPIENT_REQUIRED/);
 assert.equal(transports,0);assert.equal(ordinary,0);assert.equal((await mailer({...message,studyId:'ordinary'})).status,'original');assert.equal(ordinary,1);
});
test('SMTP acceptance without the matching persisted digest never proves delivery',async()=>{
 const mailer=createSimulationStudyMailer({targets,receipt:()=>null,transportFactory:()=>({sendMail:async()=>({accepted:[message.address]}),close(){}})});assert.equal((await mailer(message)).status,'unknown');
});
