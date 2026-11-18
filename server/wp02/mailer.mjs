import nodemailer from 'nodemailer';
import {randomUUID} from 'node:crypto';

export const syntheticEmail=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9.!#$%&'*+/=?^_`{|}~-]{0,63}@(example\.test|example\.org)$/.test(value);
export function createAccountMailer(config,{receipt,transportFactory=nodemailer.createTransport}={}) {
  if(config.mode!=='capture'||config.smtpHost!=='127.0.0.1'||!Number.isInteger(config.smtpPort)||config.smtpPort<1||config.smtpPort>65535)throw new Error('WP02_MAIL_MODE_REJECTED');
  // Nodemailer SMTP options: https://nodemailer.com/smtp ; no verify or auto-retry.
  const transport=transportFactory({host:'127.0.0.1',port:config.smtpPort,secure:false,ignoreTLS:true,
    connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000,
    disableFileAccess:true,disableUrlAccess:true,logger:false,debug:false});
  return {async send({purpose,to,tokenUrl,expiresAt}){
    const routes={register:['p004','verify'],reset:['p005','reset'],invite:['p010','invite']},route=routes[purpose];
    const expires=new Date(expiresAt).getTime();
    if(!route||!syntheticEmail(to)||!Number.isFinite(expires)||expires<=Date.now()||expires>Date.now()+73*3600000||
      typeof tokenUrl!=='string'||!tokenUrl.startsWith(config.baseUrl+'/pages/'+route[0]+'/#'+route[1]+'=')||
      !/^[A-Za-z0-9_-]{43}$/.test(tokenUrl.split('=')[1]??''))throw new Error('WP02_MAIL_INPUT_REJECTED');
    const id=randomUUID();
    try {
      const result=await transport.sendMail({from:'researchhub@example.test',to,subject:({register:'确认灵枢心域合成账号',reset:'重置合成账号密码',invite:'合成Study成员邀请'})[purpose],
        text:`仅供本机合成验证，不是外部邮件。请在浏览器打开并明确确认：\n${tokenUrl}\n有效期至 ${new Date(expires).toISOString()}。如非本人操作请忽略。`,textEncoding:'base64',
        headers:{'X-WP02-ID':id,'X-WP02-Purpose':purpose,'X-WP02-Expires':String(expires)},disableFileAccess:true,disableUrlAccess:true});
      const captured=await receipt?.(id);
      return result.accepted?.includes(to)&&captured?.id===id&&captured.to===to&&captured.expiresAt===expires?
        {status:'captured',messageId:id,digest:captured.digest}:{status:'unknown'};
    } catch(error) {return {status:['EENVELOPE','ECONNECTION','ECONNREFUSED'].includes(error.code)?'failed':'unknown'};}
  }};
}
