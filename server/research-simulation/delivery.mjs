import {randomUUID} from 'node:crypto';
import nodemailer from 'nodemailer';

/** Explicit case-bound loopback transport. Other studies keep the configured channel. */
export function createSimulationStudyMailer({targets,original,receipt,transportFactory=nodemailer.createTransport}){
 const cases=new Map(targets.map(t=>[t.studyId,t]));
 return async message=>{
  const target=cases.get(message.studyId);
  if(!target){if(typeof original!=='function')throw Error('OUTREACH_CHANNEL_UNAVAILABLE');return original(message);}
  const prefix=target.caseId.replace(/-case$/,'')+'-',address=message.address;
  if(typeof address!=='string'||!address.startsWith(prefix)||!/^[-a-z0-9._]+@example\.test$/.test(address))throw Error('SIMULATION_LOCAL_RECIPIENT_REQUIRED');
  const url=new URL(message.invitationUrl);
  if(url.origin!=='http://127.0.0.1:19501'||!/^\/h5\/questionnaire\/[A-Za-z0-9_-]+$/.test(url.pathname)||url.search||url.hash)throw Error('SIMULATION_INVITATION_INVALID');
  if(message.signal?.aborted)return{status:'unknown'};
  const id=randomUUID(),expiresAt=Date.now()+72*3600000;
  const transport=transportFactory({host:'127.0.0.1',port:19506,secure:false,ignoreTLS:true,connectionTimeout:3000,socketTimeout:5000,disableFileAccess:true,disableUrlAccess:true,logger:false,debug:false});
  const abort=()=>transport.close();message.signal?.addEventListener('abort',abort,{once:true});
  try{
   const result=await transport.sendMail({from:'researchhub@example.test',to:address,subject:'科研问卷邀请（整课题合成模拟）',text:'仅用于整课题合成数据模拟。请填写当前访视的PHQ-9：\n'+url.href+'\n请勿转发。',textEncoding:'base64',headers:{'X-WP02-ID':id,'X-WP02-Purpose':'full-study-simulation','X-WP02-Expires':String(expiresAt)}});
   const captured=await receipt?.(id);
   return result.accepted?.includes(address)&&captured?.id===id&&captured.to===address&&captured.expiresAt===expiresAt&&/^[a-f0-9]{64}$/.test(captured.digest)?{status:'accepted',providerMessageId:id}:{status:'unknown'};
  }catch{return{status:'unknown'};}finally{message.signal?.removeEventListener('abort',abort);transport.close();}
 };
}
