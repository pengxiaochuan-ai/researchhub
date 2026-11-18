import {createHash} from 'node:crypto';

const schemaVersion='researchhub.account-status.receipt.v1';
const identifier=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value);
const key=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{8,128}$/.test(value);
const iso=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const fail=(status,code,message)=>{throw Object.assign(new Error(message),{status,code});};
const invalid=()=>fail(400,'HUB_ACCOUNT_INPUT_INVALID','操作内容无效，请刷新资料后重试。');
function principalValid(user){if(!identifier(user?.tenantId)||!identifier(user.accountId)||!Number.isSafeInteger(user.authVersion)||user.authVersion<0)fail(403,'HUB_ACCOUNT_RECEIPT_AUTH_REQUIRED','当前身份无权核对此操作。');}
function inputValid(input){
 if(!input||Array.isArray(input)||Object.keys(input).sort().join(',')!=='expectedVersion,requestKey,status,targetAccountId'||
  !identifier(input.targetAccountId)||!['active','disabled'].includes(input.status)||!iso(input.expectedVersion)||!key(input.requestKey))invalid();
}
function resultValid(result){return result&&Object.keys(result).sort().join(',')==='authVersion,id,refundedTokens,status,version'&&identifier(result.id)&&
 ['active','disabled'].includes(result.status)&&iso(result.version)&&Number.isSafeInteger(result.authVersion)&&result.authVersion>=0&&
 typeof result.refundedTokens==='string'&&/^(0|[1-9][0-9]{0,29})$/.test(result.refundedTokens);}
export async function readAccountReceipt({db,principal,requestKey}){
 principalValid(principal);if(!key(requestKey))invalid();let row;
 try{[row]=await db.$queryRaw`SELECT public.researchhub_read_account_receipt(${principal.tenantId},${principal.accountId},${principal.authVersion}::integer,${requestKey}) AS receipt`;}
 catch(error){if(error.meta?.message?.includes('HUB_ACCOUNT_RECEIPT_AUTH_REQUIRED'))fail(403,'HUB_ACCOUNT_RECEIPT_AUTH_REQUIRED','当前身份无权核对此操作。');fail(503,'HUB_ACCOUNT_RECEIPT_UNAVAILABLE','操作结果暂时无法核对，请勿重复提交。');}
 if(row?.receipt===null)return null;
 const receipt=row?.receipt;
 if(!receipt||Object.keys(receipt).sort().join(',')!=='completedAt,requestHash,requestKey,result'||receipt.requestKey!==requestKey||
  typeof receipt.requestHash!=='string'||!/^[a-f0-9]{64}$/.test(receipt.requestHash)||!iso(receipt.completedAt)||!resultValid(receipt.result))
  fail(503,'HUB_ACCOUNT_RECEIPT_INVALID','操作结果暂时无法核对，请勿重复提交。');
 return receipt;
}

// Internal receipt envelope only, not an account-management endpoint. The caller
// owns full business eligibility (self/last admin, active managers, in-flight jobs)
// and the outer transaction. submit must use this bound tx and may not perform
// external I/O or open a second transaction. Never expose callbacks as HTTP input.
export async function submitWithAccountReceipt({db,principal,input},submit){
 principalValid(principal);inputValid(input);
 const requestHash=createHash('sha256').update(JSON.stringify([schemaVersion,principal.tenantId,principal.accountId,input.targetAccountId,input.status,input.expectedVersion])).digest('hex');
 const prior=await readAccountReceipt({db,principal,requestKey:input.requestKey});
 if(prior){if(prior.requestHash!==requestHash)fail(409,'HUB_ACCOUNT_REQUEST_CONFLICT','同一次操作的内容已变化，请核对后重新操作。');return prior.result;}
 const target=await db.account.findFirst({where:{id:input.targetAccountId,tenantId:principal.tenantId},select:{id:true,username:true,updatedAt:true}});
 if(!target)fail(404,'HUB_ACCOUNT_NOT_FOUND','账号不存在或当前身份无权访问。');
 if(target.updatedAt.toISOString()!==input.expectedVersion)fail(409,'HUB_ACCOUNT_VERSION_CONFLICT','账号资料已变化，请刷新核对后重试。');
 let stamped=false;
 const bound=new Proxy(db,{get(tx,name){
  if(name==='$transaction')throw Error('HUB_ACCOUNT_SECOND_TRANSACTION_REJECTED');
  if(name!=='auditLog')return tx[name];
  return new Proxy(tx.auditLog,{get(model,method){
   if(method!=='createMany')return model[method];
   return async args=>{
    const data=args?.data;
    if(stamped||!data||Array.isArray(data)||data.tenantId!==principal.tenantId||data.accountId!==principal.accountId||
     data.action!=='update_account'||data.target!==target.username||data.meta?.status!==input.status||data.researchProjectId||data.studyGroupId)
     throw Error('HUB_ACCOUNT_RECEIPT_AUDIT_MISMATCH');
    const current=await db.account.findFirst({where:{id:target.id,tenantId:principal.tenantId},select:{id:true,status:true,updatedAt:true,authVersion:true}});
    const result=current&&{id:current.id,status:current.status,version:current.updatedAt.toISOString(),authVersion:current.authVersion,refundedTokens:data.meta.refundedTokens};
    if(!resultValid(result)||result.status!==input.status)throw Error('HUB_ACCOUNT_RECEIPT_RESULT_MISMATCH');
    const written=await model.createMany({...args,data:{...data,researchProjectId:null,studyGroupId:null,meta:{...data.meta,schemaVersion,requestKey:input.requestKey,requestHash,targetAccountId:target.id,result}}});
    if(written.count!==1)throw Error('HUB_ACCOUNT_RECEIPT_NOT_WRITTEN');stamped=true;return written;
   };
  }});
 }});
 await submit(bound);
 if(!stamped)throw Error('HUB_ACCOUNT_RECEIPT_NOT_WRITTEN');
 const saved=await readAccountReceipt({db,principal,requestKey:input.requestKey});
 if(!saved||saved.requestHash!==requestHash)throw Error('HUB_ACCOUNT_RECEIPT_NOT_WRITTEN');
 return saved.result;
}
