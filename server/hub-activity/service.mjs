import {projectPublicActivity,readActivityQuery} from './projection.mjs';
import {activityIdentityKey} from './identity.mjs';

function evidenced(row){return row?.timeStatus==='verified'&&typeof row.firstPublicAt==='string'&&Number.isFinite(Date.parse(row.firstPublicAt))&&Array.isArray(row.proofRefs)&&row.proofRefs.length>0;}
export function createPublicActivityReader({tenantId,transact,findHub,readSources,readFacts,readPublicContent,now=()=>new Date()}){
 if(!tenantId||[transact,findHub,readSources,readFacts,now].some(fn=>typeof fn!=='function'))throw Error('PUBLIC_ACTIVITY_DEPENDENCIES_REQUIRED');
 return async(hubKey,query={})=>{
  const {limit}=readActivityQuery(query);
  if(typeof hubKey!=='string'||!/^[a-z][a-z0-9-]{0,79}$/.test(hubKey))throw Error('HUB_NOT_FOUND');
  const scope={tenantId,hubKey};
  // F03 owns an elevated, independently scoped transaction. Finish it before
  // taking the shared source-reader lock to avoid waiting on ourselves.
  let content,contentError;
  try{if(typeof readPublicContent!=='function')throw Error('PUBLIC_CONTENT_UNAVAILABLE');content=await readPublicContent(scope);}
  catch(error){contentError=error;}
  return transact(async db=>{
   if(!await findHub(db,scope))throw Error('HUB_NOT_FOUND');
   const date=now();
   const ledger=await readFacts(db,scope);
   const facts=new Map();
   for(const fact of ledger.facts??[]){
    if(!evidenced(fact))continue;
    const key=activityIdentityKey(fact);
    if(!key||Date.parse(fact.firstPublicAt)>date.getTime())continue;
    const previous=facts.get(key);
    if(!previous||Date.parse(fact.firstPublicAt)<Date.parse(previous.firstPublicAt))facts.set(key,fact);
   }
   const datedCategories=new Set([...facts.values()].map(fact=>fact.category));
   const snapshot=await readSources({db,...scope,now:date,datedCategories,readPublicContent:async()=>{if(contentError)throw contentError;return content;}});
   const records=snapshot.records.map(record=>{
    const fact=facts.get(activityIdentityKey(record));
    if(!fact||evidenced(record)&&Date.parse(record.firstPublicAt)<=Date.parse(fact.firstPublicAt))return record;
    return{...record,firstPublicAt:fact.firstPublicAt,timeStatus:'verified',proofRefs:fact.proofRefs};
   });
   const categoryStatuses=Object.fromEntries(Object.entries(snapshot.categoryStatuses??{}).map(([category,state])=>[category,
    state.status==='ready'&&state.dateCoverage!=='unknown'?{...state,dateCoverage:records.filter(r=>r.category===category).every(evidenced)?'complete':'partial'}:state]));
   const result=projectPublicActivity({records,categoryStatuses,limit,now:date});
   return{...result,...(ledger.status!=='ready'?{status:'partial'}:{}),ledgerStatus:ledger.status};
  });
 };
}
