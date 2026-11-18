import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {invalid} from '../research-studies/contract.mjs';
const processSecret=randomBytes(32);
export function cursorCodec(secret=processSecret){
 if(!(typeof secret==='string'&&secret.length>0)&&!Buffer.isBuffer(secret))throw new Error('CURSOR_SECRET_REQUIRED');
 const signature=body=>createHmac('sha256',secret).update(body).digest();
 return {
  encode(binding,last){const body=Buffer.from(JSON.stringify({binding,last})).toString('base64url');return body+'.'+signature(body).toString('base64url');},
  decode(value,binding,validateLast){
   if(typeof value!=='string'||value.length>4096||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value))invalid();const [body,tag]=value.split('.'),actual=Buffer.from(tag,'base64url'),expected=signature(body);if(actual.length!==expected.length||!timingSafeEqual(actual,expected))invalid();
   let payload;try{payload=JSON.parse(Buffer.from(body,'base64url').toString('utf8'));}catch{invalid();}
   if(!payload||Object.keys(payload).sort().join(',')!=='binding,last'||JSON.stringify(payload.binding)!==JSON.stringify(binding)||!validateLast(payload.last))invalid();return payload.last;
  },
 };
}
export const cursorBinding=(user,studyId,kind,filter)=>({tenant:user.tenantId,actor:user.accountId,version:user.authVersion,studyId,kind,filter});
export function pageLimit(value){if(value===undefined)return 20;if((typeof value!=='string'&&typeof value!=='number')||!/^[1-9][0-9]{0,2}$/.test(String(value)))invalid();const n=Number(value);if(n>100)invalid();return n;}
