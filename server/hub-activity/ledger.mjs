import {createHash} from 'node:crypto';
import {activityIdentityKey} from './identity.mjs';

const invalid=()=>{throw Error('PUBLIC_ACTIVITY_FACT_INVALID');};
const key=value=>typeof value==='string'&&value.length>0&&value.length<=512&&value===value.trim()&&!/[\x00-\x1f\x7f]/.test(value);
function assertScope(scope){if(!scope||!key(scope.tenantId)||!key(scope.hubKey))throw Error('PUBLIC_ACTIVITY_SCOPE_REJECTED');}
function instant(value){
 if(value instanceof Date)value=value.toISOString();
 if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value))invalid();
 const d=new Date(value);if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,19)!==value.slice(0,19))invalid();return d.toISOString();
}

// This is an internal contract, not an approval oracle: callers must establish
// complete eligibility from committed source events in the same trusted scope.
export function normalizeFirstPublicFact(scope,input,{observedAt=new Date().toISOString()}={}){
 assertScope(scope);if(!input||!activityIdentityKey(input)||!key(input.ruleVersion))invalid();
 if(!['verified','historical_undated'].includes(input.timeStatus))invalid();
 if(!Array.isArray(input.proofRefs)||input.proofRefs.length<1||input.proofRefs.length>64||input.proofRefs.some(r=>!key(r)||!/^[-a-z][a-z0-9_-]*:[A-Za-z0-9_:/.-]+$/.test(r)||r.includes('://')))invalid();
 const proofRefs=[...new Set(input.proofRefs)].sort(),observed=instant(observedAt);
 const firstPublicAt=input.firstPublicAt==null?null:instant(input.firstPublicAt);
 if((input.timeStatus==='verified')!==(firstPublicAt!==null)||firstPublicAt&&firstPublicAt>observed)invalid();
 const fact={tenantId:scope.tenantId,hubKey:scope.hubKey,category:input.category,entityKey:input.entityKey,timeStatus:input.timeStatus,firstPublicAt,proofRefs,ruleVersion:input.ruleVersion};
 return{...fact,observedAt:observed,evidenceHash:createHash('sha256').update(JSON.stringify(fact)).digest('hex')};
}

export function chooseFirstPublicFact(existing,incoming){
 if(!existing)return incoming;
 if(['tenantId','hubKey','category','entityKey'].some(k=>existing[k]!==incoming[k]))throw Error('PUBLIC_ACTIVITY_SCOPE_REJECTED');
 if(incoming.firstPublicAt===null)return existing;
 if(existing.firstPublicAt===null||incoming.firstPublicAt<existing.firstPublicAt)return incoming;
 return existing;
}

async function transactionScope(db,scope){
 assertScope(scope);
 const [current]=await db.$queryRawUnsafe("SELECT current_setting('app.tenant_id',true) AS tenant,current_setting('app.hub_key',true) AS hub");
 if(current?.tenant!==scope.tenantId||current?.hub!==scope.hubKey)throw Error('PUBLIC_ACTIVITY_SCOPE_REJECTED');
}

export async function readExistingFacts(db,scope){
 await transactionScope(db,scope);
 const rows=await db.$queryRawUnsafe('SELECT category,entity_key AS "entityKey",first_public_at AS "firstPublicAt",time_status AS "timeStatus",proof_refs AS "proofRefs",rule_version AS "ruleVersion" FROM rh_hub_activity.first_public WHERE tenant_id=$1 AND hub_key=$2 ORDER BY category,entity_key',scope.tenantId,scope.hubKey);
 return rows.map(row=>({...row,firstPublicAt:row.firstPublicAt==null?null:instant(row.firstPublicAt)}));
}

// No HTTP writer exists. This requires a caller-owned transaction using the
// migration owner connection; aisci_app receives no DML grants on these tables.
export async function recordFirstPublicFact(db,scope,input,options={}){
 const fact=normalizeFirstPublicFact(scope,input,options);await transactionScope(db,scope);
 await db.$executeRawUnsafe('INSERT INTO rh_hub_activity.evidence(tenant_id,hub_key,category,entity_key,evidence_hash,time_status,first_public_at,proof_refs,rule_version,observed_at) VALUES($1,$2,$3,$4,$5,$6,$7::timestamptz,$8::jsonb,$9,$10::timestamptz) ON CONFLICT(tenant_id,hub_key,category,entity_key,evidence_hash) DO NOTHING',fact.tenantId,fact.hubKey,fact.category,fact.entityKey,fact.evidenceHash,fact.timeStatus,fact.firstPublicAt,JSON.stringify(fact.proofRefs),fact.ruleVersion,fact.observedAt);
 const rows=await db.$queryRawUnsafe(`INSERT INTO rh_hub_activity.first_public(tenant_id,hub_key,category,entity_key,evidence_hash,time_status,first_public_at,proof_refs,rule_version,observed_at)
 VALUES($1,$2,$3,$4,$5,$6,$7::timestamptz,$8::jsonb,$9,$10::timestamptz)
 ON CONFLICT(tenant_id,hub_key,category,entity_key) DO UPDATE SET
 evidence_hash=EXCLUDED.evidence_hash,time_status=EXCLUDED.time_status,first_public_at=EXCLUDED.first_public_at,proof_refs=EXCLUDED.proof_refs,rule_version=EXCLUDED.rule_version
 WHERE EXCLUDED.first_public_at IS NOT NULL AND (rh_hub_activity.first_public.first_public_at IS NULL OR EXCLUDED.first_public_at<rh_hub_activity.first_public.first_public_at)
 RETURNING category,entity_key AS "entityKey",time_status AS "timeStatus",first_public_at AS "firstPublicAt"`,fact.tenantId,fact.hubKey,fact.category,fact.entityKey,fact.evidenceHash,fact.timeStatus,fact.firstPublicAt,JSON.stringify(fact.proofRefs),fact.ruleVersion,fact.observedAt);
 return{changed:rows.length===1,evidenceHash:fact.evidenceHash};
}
