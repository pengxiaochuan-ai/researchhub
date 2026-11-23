import {getHub} from '../hub/repository.mjs';
export async function readActiveActivityHub(db,{tenantId,hubKey}){
 const [active]=await db.$queryRaw`SELECT h.hub_key FROM rh_hub.hub h JOIN public.tenant t ON t.id=h.tenant_id WHERE h.tenant_id=${tenantId} AND h.hub_key=${hubKey} AND h.status='active' AND t.status='active'`;
 return active?getHub({db,tenantId,hubKey}):null;
}
