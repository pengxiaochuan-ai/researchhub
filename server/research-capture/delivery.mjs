import {createHash} from 'node:crypto';
import nodemailer from 'nodemailer';
import {studySmtpOptions} from './smtp-config.mjs';

/** One SMTP attempt. Transport errors are ambiguous and must never trigger automatic retry. */
export async function sendStudyInvitationEmail(config,{address,invitationUrl},{transportFactory=nodemailer.createTransport,signal}={}){
 if(typeof address!=='string'||address.length>254||!/^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/.test(address))throw Error('OUTREACH_ADDRESS_INVALID');
 let url;try{url=new URL(invitationUrl);}catch{throw Error('OUTREACH_LINK_INVALID');}
 const local=url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname);
 if((url.protocol!=='https:'&&!local)||url.username||url.password||url.hash||!url.pathname.startsWith('/h5/questionnaire/'))throw Error('OUTREACH_LINK_INVALID');
 const transport=transportFactory(studySmtpOptions(config));
 let closed=false;const close=()=>{if(!closed){closed=true;transport.close();}};
 let abort;const interrupted=new Promise(resolve=>{abort=()=>{close();resolve({status:'unknown'});};});
 if(signal?.aborted){close();return {status:'unknown'};}
 signal?.addEventListener('abort',abort,{once:true});
 try{
  const result=await Promise.race([transport.sendMail({from:config.from,to:address,subject:local?'科研问卷邀请（合成测试）':'科研问卷邀请',text:`您好，请通过以下链接填写科研问卷：\n${url.href}\n${local?'本次为合成测试，链接仅可在运行岐研的本机打开。\n':''}请勿转发此链接。`}),interrupted]);
  if(result?.status==='unknown')return {status:'unknown'};
  if(!Array.isArray(result?.accepted)||!result.accepted.length)return {status:'rejected'};
  if(typeof result.messageId!=='string'||!result.messageId)return {status:'unknown'};
  return {status:'accepted',providerMessageId:'sha256:'+createHash('sha256').update(result.messageId).digest('hex')};
 }catch{return {status:'unknown'};}finally{signal?.removeEventListener('abort',abort);close();}
}

/** The adapter supplies the abort signal; closing the transport bounds the in-flight transaction. */
export const createStudyMailer=(config,options={})=>({address,invitationUrl,signal})=>sendStudyInvitationEmail(config,{address,invitationUrl},{...options,signal});
