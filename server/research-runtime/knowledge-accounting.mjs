import {createAccountedRuntime} from '../billing/runtime.mjs';
import {createHubBilling} from '../billing/service.mjs';

export function createKnowledgeAccounting({prisma,context,billing,verify,scope,load}){
 const transaction=fn=>prisma.elevated.$transaction(fn);
 return createAccountedRuntime({native:billing,service:createHubBilling({scope,transaction,billing}),context,transaction,
  authorize:async(tx,turn)=>{
   await load('common/worker-publication','lockAuthorizationMutation')(tx,turn.user.tenantId,{includeOfficial:true});
   await load('common/worker-claim','assertLiveClaim')(tx,scope,turn.execution.claim);
   await load('common/worker-authorization','assertWorkerAuthorized')(tx,scope,turn.execution.claim,{toolKeys:['knowledge.search']});
   await verify(turn,tx);
  },
 });
}
