import {openSync,readSync,closeSync,fstatSync} from 'node:fs';
import {StringDecoder} from 'node:string_decoder';
import {parseEnv} from 'node:util';
import nodemailer from 'nodemailer';
const keys=['SMTP_HOST','SMTP_PORT','SMTP_FROM','SMTP_USER','SMTP_PASS'];
const invalid=()=>{throw Error('STUDY_SMTP_CONFIG_INVALID');};
export function readStudyMailConfig({file}){
 const fd=openSync(file,'r'),decoder=new StringDecoder('utf8'),selected=[],names=[];let pending='',quote=null;
 try{
  if(fstatSync(fd).size>1024*1024)invalid();
  const closes=(line,q,from=0)=>{for(let i=from;i<line.length;i++)if(line[i]===q){let slashes=0;for(let j=i-1;j>=0&&line[j]==='\\';j--)slashes++;if(slashes%2===0)return true;}return false;};
  const inspect=line=>{
   if(quote){if(closes(line,quote))quote=null;return;}
   const match=line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(['"])?/);if(!match)return;
   const name=match[1],q=match[2];if(q&&!closes(line,q,match[0].length)){if(keys.includes(name))invalid();quote=q;return;}
   if(keys.includes(name)){names.push(name);selected.push(line);}
  };
  const bytes=Buffer.alloc(4096);let n;
  while((n=readSync(fd,bytes,0,bytes.length,null))>0){pending+=decoder.write(bytes.subarray(0,n));let at;while((at=pending.indexOf('\n'))>=0){inspect(pending.slice(0,at));pending=pending.slice(at+1);}if(pending.length>65536)invalid();}
  pending+=decoder.end();if(pending)inspect(pending);
 }finally{closeSync(fd);}
 if(keys.some(key=>names.filter(name=>name===key).length!==1))invalid();
 return smtpConfigFromEnv(parseEnv(selected.join('\n')));
}
export function smtpConfigFromEnv(env){
 const values=Object.fromEntries(keys.map(key=>[key,env[key]]));
 if(Object.values(values).some(value=>typeof value!=='string'||!value.trim()))invalid();
 const port=Number(values.SMTP_PORT);
 if(!/^\d{1,5}$/.test(values.SMTP_PORT)||!Number.isInteger(port)||port<1||port>65535||!/^[A-Za-z0-9.-]+$/.test(values.SMTP_HOST)||!values.SMTP_HOST.includes('.')||values.SMTP_HOST.startsWith('.')||values.SMTP_HOST.endsWith('.')||!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(values.SMTP_FROM)||/[\r\n\0]/.test(values.SMTP_USER))invalid();
 return Object.freeze({host:values.SMTP_HOST,port,from:values.SMTP_FROM,user:values.SMTP_USER,pass:values.SMTP_PASS,secure:port===465});
}
export function studySmtpOptions(config){
 return {host:config.host,port:config.port,secure:config.secure,requireTLS:!config.secure,
  auth:{user:config.user,pass:config.pass},tls:{minVersion:'TLSv1.2'},
  connectionTimeout:15000,greetingTimeout:15000,socketTimeout:20000,
  disableFileAccess:true,disableUrlAccess:true,logger:false,debug:false};
}
export async function verifyStudySmtp(config,{transportFactory=nodemailer.createTransport}={}){
 const transport=transportFactory(studySmtpOptions(config));
 try{await transport.verify();return {verified:true,code:null};}
 catch(error){return {verified:false,code:['EAUTH','ETLS','ESOCKET','ECONNECTION','ECONNREFUSED','ETIMEDOUT','EDNS','EPROTOCOL'].includes(error?.code)?error.code:'SMTP_VERIFY_FAILED'};}
 finally{transport.close();}
}
