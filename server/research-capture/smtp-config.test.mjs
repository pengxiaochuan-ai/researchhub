import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readStudyMailConfig,verifyStudySmtp} from './smtp-config.mjs';
const text='SMTP_HOST=smtp.example.org\nSMTP_PORT=465\nSMTP_FROM=sender@example.org\nSMTP_USER=sender@example.org\nSMTP_PASS=placeholder-only\nDATABASE_URL=postgresql://do-not-import\n';
function fixture(content){const dir=mkdtempSync(join(tmpdir(),'rh-mail-config-')),file=join(dir,'env.prod');writeFileSync(file,content,{mode:0o600});return {file,close:()=>rmSync(dir,{recursive:true})};}
test('reads only SMTP keys without importing production environment and requires encrypted transport',()=>{
 const f=fixture(text),before=process.env.DATABASE_URL;
 try{const config=readStudyMailConfig({file:f.file});assert.equal(config.host,'smtp.example.org');assert.equal(config.secure,true);assert.equal(config.port,465);assert.equal('DATABASE_URL' in config,false);assert.equal(process.env.DATABASE_URL,before);assert.equal(readFileSync(f.file,'utf8'),text);}finally{f.close();}
});
test('missing, duplicate and header injection inputs fail closed',()=>{
 for(const content of [text.replace('SMTP_PASS=placeholder-only','SMTP_PASS='),text+'SMTP_HOST=other.example.org\n',text.replace('sender@example.org\nSMTP_USER','"sender@example.org\\r\\nBcc:bad@example.org"\nSMTP_USER'),text.replace('SMTP_PORT=465','SMTP_PORT=invalid')]){
  const f=fixture(content);try{assert.throws(()=>readStudyMailConfig({file:f.file}),/STUDY_SMTP_CONFIG_INVALID/);}finally{f.close();}
 }
});
test('verify authenticates with TLS and closes transport without sending any message',async()=>{
 const f=fixture(text);let closed=false,verified=false;
 try{const config=readStudyMailConfig({file:f.file});const result=await verifyStudySmtp(config,{transportFactory:opts=>{assert.equal(opts.logger,false);assert.equal(opts.debug,false);assert.equal(opts.tls.minVersion,'TLSv1.2');assert.equal(opts.disableUrlAccess,true);return {verify:async()=>{verified=true;return true},close:()=>closed=true,sendMail:()=>assert.fail('verify must never send')};}});assert.deepEqual(result,{verified:true,code:null});assert.equal(verified,true);assert.equal(closed,true);}finally{f.close();}
});
test('verify reports only safe failure codes and always closes transport',async()=>{
 const f=fixture(text);let closed=false;
 try{const config=readStudyMailConfig({file:f.file}),result=await verifyStudySmtp(config,{transportFactory:()=>({verify:async()=>{throw Object.assign(Error('credential or server text must not escape'),{code:'EAUTH'});},close:()=>closed=true})});assert.deepEqual(result,{verified:false,code:'EAUTH'});assert.equal(closed,true);}finally{f.close();}
});
test('ignores fake SMTP names inside unrelated multiline values and rejects multiline SMTP values',()=>{
 const unrelated='OTHER_SECRET="first line\nSMTP_HOST=wrong.example.org\nlast line"\n';
 const good=fixture(unrelated+text.replace('SMTP_PASS=placeholder-only','SMTP_PASS="quoted # value"'));try{assert.equal(readStudyMailConfig({file:good.file}).pass,'quoted # value');assert.equal(readStudyMailConfig({file:good.file}).host,'smtp.example.org');}finally{good.close();}
 const bad=fixture(text.replace('SMTP_PASS=placeholder-only','SMTP_PASS="line one\nline two"'));try{assert.throws(()=>readStudyMailConfig({file:bad.file}),/STUDY_SMTP_CONFIG_INVALID/);}finally{bad.close();}
});
