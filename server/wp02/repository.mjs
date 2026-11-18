import {randomUUID} from 'node:crypto';
import {fault} from './policy.mjs';
export async function consumeRate(tx,{tenantId,purpose,keyHash,limit,windowMs,now=new Date()}){
 const start=new Date(Math.floor(now.getTime()/windowMs)*windowMs);
 const rows=await tx.$queryRawUnsafe('INSERT INTO wp02_request_window (id,"tenantId",purpose,"keyHash","windowStart",count) VALUES ($1,$2,$3,$4,$5,1) ON CONFLICT ("tenantId",purpose,"keyHash","windowStart") DO UPDATE SET count=wp02_request_window.count+1 WHERE wp02_request_window.count<$6 RETURNING count',randomUUID(),tenantId,purpose,keyHash,start,limit);
 if(!rows.length)throw fault('WP02_RATE_LIMITED','请求过于频繁，请稍后重试。',429);
}
export function createWp02Repository({transact,tenantId,lockAuthorization}){
 return{tenantId,async transaction(fn){return transact(async tx=>{await lockAuthorization(tx,tenantId);await tx.$executeRawUnsafe("SELECT set_config('app.tenant_id',$1,true)",tenantId);const tenant=await tx.tenant.findFirst({where:{id:tenantId,status:'active'},select:{id:true}});if(!tenant)throw fault('WP02_UNAVAILABLE','当前注册租户不可用。',503);return fn(tx);});}};
}
