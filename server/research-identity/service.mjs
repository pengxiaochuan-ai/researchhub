import {identityError,emptyResearchProfile,normalizeProfileChanges,assertEstablishable,parseProfileCommand,profileRequestHash} from './policy.mjs';

export function createResearchIdentityService({db,now=()=>new Date()}){
  const unauth=()=>{throw identityError('IDENTITY_UNAUTHENTICATED',401,'会话已失效，请重新登录。');};
  async function account(tx,ctx,lock=false){
    const user=ctx?.user;if(!user||user.tenantId!==db.tenantId||typeof user.accountId!=='string'||!Number.isSafeInteger(user.authVersion))unauth();
    const rows=await tx.$queryRawUnsafe(`SELECT a.id,a."authVersion",a."researchProfile",a."researchProfileVersion",a."researchProfileEstablishedAt",a."researchProfileLastMutation" FROM public.account a JOIN public.tenant t ON t.id=a."tenantId" WHERE a.id=$1 AND a."tenantId"=$2 AND a.status='active' AND t.status='active' ${lock?'FOR UPDATE OF a':''}`,user.accountId,db.tenantId);
    const a=rows[0];if(!a||a.authVersion!==user.authVersion)unauth();return a;
  }
  const version=a=>a.researchProfileVersion??0;
  const level=a=>a.researchProfileEstablishedAt?'L1':'L0';
  const safeReceipt=(a,more={})=>({saved:true,version:version(a),level:level(a),establishedAt:a.researchProfileEstablishedAt?.toISOString()??null,...more});
  const snapshot=a=>{const profile=normalizeProfileChanges({},a.researchProfile??emptyResearchProfile());const missingFields=[...(!profile.researchName?['researchName']:[]),...(!profile.researchDirections.length?['researchDirections']:[])];return{profile,version:version(a),establishedAt:a.researchProfileEstablishedAt?.toISOString()??null,level:level(a),missingFields,verificationStage:'NOT_OPEN',sourceType:'SELF_DECLARED'};};
  async function write(ctx,body,action){
    const input=parseProfileCommand(action,body),requestHash=profileRequestHash(action,input);
    return db.transaction(async tx=>{
      const a=await account(tx,ctx,true),last=a.researchProfileLastMutation;
      if(last?.requestKey===input.requestKey&&last.baseVersion===input.expectedVersion){if(last.requestHash!==requestHash)throw identityError('IDENTITY_REQUEST_CONFLICT',409,'该提交编号已用于不同资料。');return last.result;}
      if(version(a)!==input.expectedVersion)throw identityError('IDENTITY_PROFILE_CONFLICT',409,'科研资料已变化，请核对当前版本；输入仍可保留。');
      if(action==='establish'&&a.researchProfileEstablishedAt)return safeReceipt(a,{alreadyEstablished:true});
      const profile=normalizeProfileChanges(action==='save'?input.changes:{},a.researchProfile);
      if(action==='establish'||a.researchProfileEstablishedAt)assertEstablishable(profile);
      const date=now(),establishedAt=a.researchProfileEstablishedAt??(action==='establish'?date:null);
      const result={saved:true,version:version(a)+1,level:establishedAt?'L1':'L0',establishedAt:establishedAt?.toISOString()??null};
      const receipt={requestKey:input.requestKey,requestHash,baseVersion:input.expectedVersion,resultVersion:result.version,committedAt:date.toISOString(),result};
      const changed=await tx.$executeRaw`UPDATE public.account SET "researchProfile"=${JSON.stringify(profile)}::jsonb,"researchProfileVersion"=${result.version},"researchProfileEstablishedAt"=${establishedAt},"researchProfileLastMutation"=${JSON.stringify(receipt)}::jsonb WHERE id=${a.id} AND "tenantId"=${db.tenantId} AND COALESCE("researchProfileVersion",0)=${input.expectedVersion} AND "authVersion"=${ctx.user.authVersion} AND status='active'`;
      if(changed!==1)throw identityError('IDENTITY_PROFILE_CONFLICT',409,'科研资料已变化，请重新核对。');
      await tx.auditLog.createMany({data:[{tenantId:db.tenantId,accountId:a.id,studyGroupId:null,researchProjectId:null,action:'research_identity_'+action,target:a.id,meta:{requestKey:input.requestKey,baseVersion:input.expectedVersion,resultVersion:result.version,changedFields:action==='save'?Object.keys(input.changes).sort():['researchProfileEstablishedAt'],contentHash:profileRequestHash('content',profile)}}]});
      return result;
    });
  }
  return {
    read:ctx=>db.transaction(async tx=>snapshot(await account(tx,ctx))),
    save:(ctx,body)=>write(ctx,body,'save'),
    establish:(ctx,body)=>write(ctx,body,'establish'),
    receipt:(ctx,key,base)=>{parseProfileCommand('establish',{requestKey:key,expectedVersion:base});return db.transaction(async tx=>{const a=await account(tx,ctx),last=a.researchProfileLastMutation;if(last?.requestKey!==key||last.baseVersion!==base)throw identityError('IDENTITY_RECEIPT_NOT_FOUND',404,'当前没有匹配的最近提交回执，请核对当前资料，不要直接重复创建。');return last.result;});},
    identity:ctx=>db.transaction(async tx=>{const a=await account(tx,ctx);return{level:level(a),profileEstablished:Boolean(a.researchProfileEstablishedAt),profileVersion:version(a),verificationStage:'NOT_OPEN',qualifications:[]};}),
  };
}
