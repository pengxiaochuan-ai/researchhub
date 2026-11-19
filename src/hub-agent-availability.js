const unavailableMessage='科研 AI 暂未启用，当前无法提问。请联系平台管理员。';

export function resolveHubAgentAvailability(agents,status){
  if(status?.enabled===false){
    return Array.isArray(status.reasons)&&status.reasons.includes('HUB_CHAT_ACCESS_NOT_GRANTED')
      ? {kind:'restricted'}
      : {kind:'unavailable',message:status.code==='HUB_CHAT_NOT_CONFIGURED'?unavailableMessage:'科研 AI 暂时不可用，请稍后重试或联系平台管理员。'};
  }
  const agent=Array.isArray(agents)?agents.find(item=>item?.type==='research'):null;
  return agent
    ? {kind:'ready',agentId:agent.id,quota:status?.quota,materialUpload:status?.materialUpload}
    : {kind:'restricted'};
}
