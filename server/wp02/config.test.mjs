import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,chmodSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const {readWp02Config}=await import('./config.mjs');
const base='WP02_MAIL_MODE=capture\nWP02_PUBLIC_BASE_URL=http://127.0.0.1:19501\nWP02_CAPTURE_SMTP_HOST=127.0.0.1\nWP02_CAPTURE_SMTP_PORT=19506\nWP02_CAPTURE_INBOX_HOST=127.0.0.1\nWP02_CAPTURE_INBOX_PORT=19507\nWP02_CAPTURE_FROM=researchhub@example.test\n';
function fixture(value=base){const dir=mkdtempSync(join(tmpdir(),'wp02-config-')),file=join(dir,'.env');writeFileSync(file,value,{mode:0o600});return{dir,file};}
test('capture uses only loopback even when external SMTP secrets are filled',()=>{const {file}=fixture(base+'SMTP_HOST=smtp.invalid\nSMTP_USER=private\nSMTP_PASS=secret\n');const c=readWp02Config({file,approvedMode:'capture'});assert.equal(c.mode,'capture');assert.equal(c.smtpHost,'127.0.0.1');assert.equal(c.smtpPort,19506);assert.equal(JSON.stringify(c).includes('private'),false);assert.equal(JSON.stringify(c).includes('secret'),false);});
test('rejects external mode, hosts, base URL, header injection and unexpected ports',()=>{for(const [a,b]of [['MODE=capture','MODE=smtp'],['HOST=127.0.0.1','HOST=remote.invalid'],['URL=http://127.0.0.1:19501','URL=https://evil.invalid'],['PORT=19506','PORT=465'],['FROM=researchhub@example.test','FROM="a@example.test\r\nBcc: bad@example.test"']]){const {file}=fixture(base.replace(a,b));assert.throws(()=>readWp02Config({file,approvedMode:'capture'}));}});
test('rejects missing mode, duplicate keys, public file and symlink',()=>{const {dir,file}=fixture();const link=join(dir,'link');symlinkSync(file,link);assert.throws(()=>readWp02Config({file:link,approvedMode:'capture'}));chmodSync(file,0o644);assert.throws(()=>readWp02Config({file,approvedMode:'capture'}));for(const s of [base.replace('WP02_MAIL_MODE=capture\n',''),base+'WP02_MAIL_MODE=capture\n'])assert.throws(()=>readWp02Config({file:fixture(s).file,approvedMode:'capture'}));});
