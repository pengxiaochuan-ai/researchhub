// Read-only business admission. SessionsService owns the single atomic reservation
// and usage settlement; a preview must never reserve or release tokens itself.
export function createBusinessAiQuota({billing,estimateRunTokenBudget,maxTokens=1536}){
  const requiredTokens=estimateRunTokenBudget(maxTokens);
  if(typeof requiredTokens!=='bigint'||requiredTokens<1n||requiredTokens>BigInt(Number.MAX_SAFE_INTEGER))throw Error('INVALID_RUN_TOKEN_ESTIMATE');
  return{
    async status(user){
      try{
        const snapshot=await billing.myTokenQuota(user),remaining=snapshot?.effectiveRemainingTokens;
        if(typeof remaining!=='string'||!/^\d+$/.test(remaining))throw Error('INVALID_TOKEN_QUOTA');
        const canStart=BigInt(remaining)>=requiredTokens;
        return{...snapshot,requiredTokens:requiredTokens.toString(),canStart,blocked:!canStart,
          code:canStart?'TOKEN_QUOTA_READY':'TOKEN_QUOTA_EXCEEDED',
          message:canStart?'模型用量统一计入租户及账号 Token 额度。':'当前可用 Token 不足以预留本次任务，请联系租户管理员。'};
      }catch{
        return{requiredTokens:requiredTokens.toString(),canStart:false,blocked:true,code:'TOKEN_QUOTA_UNAVAILABLE',
          message:'暂时无法核对 Token 额度，请稍后刷新；已有结果仍可查看。'};
      }
    },
    assert:user=>billing.assertTokenQuota(user,Number(requiredTokens)),
  };
}
