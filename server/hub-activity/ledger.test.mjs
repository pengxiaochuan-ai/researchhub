import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeFirstPublicFact,chooseFirstPublicFact,readExistingFacts,recordFirstPublicFact} from './ledger.mjs';

const scope={tenantId:'tenant-one',hubKey:'lingshu-xinyu'};
const unknown={category:'researcher',entityKey:'researcher:one',timeStatus:'historical_undated',firstPublicAt:null,proofRefs:['audit:profile:one'],ruleVersion:'public-activity-v1'};
const verified={...unknown,timeStatus:'verified',firstPublicAt:'2026-11-20T10:00:00.000Z',proofRefs:['event:complete-public-eligibility:one']};
const observedAt='2026-11-23T01:00:00.000Z';

test('unknown historical facts never acquire an observation timestamp as first-public date',()=>{
 const fact=normalizeFirstPublicFact(scope,unknown,{observedAt});
 assert.equal(fact.firstPublicAt,null);assert.equal(fact.timeStatus,'historical_undated');assert.equal(fact.observedAt,observedAt);
});
test('verified facts require an explicit date, rule and durable proof refs',()=>{
 for(const change of [{firstPublicAt:null},{proofRefs:[]},{ruleVersion:''},{firstPublicAt:'2026-11-24T00:00:00Z'},{firstPublicAt:'2026-02-30T00:00:00Z'},{timeStatus:'historical_undated'}])
  assert.throws(()=>normalizeFirstPublicFact(scope,{...verified,...change},{observedAt}),/PUBLIC_ACTIVITY_FACT_INVALID/);
});
test('scope, six categories and stable identities are validated; credentials are not proof refs',()=>{
 for(const category of ['registration','publication','guidance','organization','researcher','platform_content'])
  assert.equal(normalizeFirstPublicFact(scope,{...verified,category},{observedAt}).category,category);
 for(const change of [{category:'account'},{entityKey:'bad\nkey'},{proofRefs:['https://user:secret@example.org/']},{proofRefs:['file:///private/key']}])
  assert.throws(()=>normalizeFirstPublicFact(scope,{...verified,...change},{observedAt}));
 assert.throws(()=>normalizeFirstPublicFact({...scope,tenantId:''},verified,{observedAt}));
});
test('replays are idempotent independently of observedAt or proof ordering',()=>{
 const a=normalizeFirstPublicFact(scope,{...verified,proofRefs:['event:z','event:a','event:z']},{observedAt});
 const b=normalizeFirstPublicFact(scope,{...verified,proofRefs:['event:a','event:z']},{observedAt:'2026-11-23T02:00:00.000Z'});
 assert.equal(a.evidenceHash,b.evidenceHash);assert.deepEqual(a.proofRefs,['event:a','event:z']);
});
test('later publication, restoration and unknown observations cannot move first-public time',()=>{
 const a=normalizeFirstPublicFact(scope,verified,{observedAt});
 const later=normalizeFirstPublicFact(scope,{...verified,firstPublicAt:'2026-11-22T10:00:00Z'},{observedAt});
 assert.equal(chooseFirstPublicFact(a,later),a);
 assert.equal(chooseFirstPublicFact(a,normalizeFirstPublicFact(scope,unknown,{observedAt})),a);
 const earlier=normalizeFirstPublicFact(scope,{...verified,firstPublicAt:'2026-11-19T10:00:00Z',proofRefs:['audit:historical-earlier-proof']},{observedAt});
 assert.equal(chooseFirstPublicFact(a,earlier),earlier);
 assert.equal(chooseFirstPublicFact(normalizeFirstPublicFact(scope,unknown,{observedAt}),a),a);
 assert.throws(()=>chooseFirstPublicFact(a,{...earlier,tenantId:'other'}),/PUBLIC_ACTIVITY_SCOPE_REJECTED/);
});
test('reader validates transaction scope and does not swallow a missing schema',async()=>{
 const db={$queryRawUnsafe:async sql=>sql.startsWith('SELECT current_setting')?[{tenant:scope.tenantId,hub:scope.hubKey}]:[{category:'researcher',entityKey:'researcher:one',firstPublicAt:new Date(verified.firstPublicAt),timeStatus:'verified',proofRefs:verified.proofRefs,ruleVersion:verified.ruleVersion}]};
 assert.equal((await readExistingFacts(db,scope))[0].firstPublicAt,verified.firstPublicAt);
 await assert.rejects(()=>readExistingFacts(db,{...scope,tenantId:'other'}),/PUBLIC_ACTIVITY_SCOPE_REJECTED/);
 const absent={$queryRawUnsafe:async sql=>{if(sql.startsWith('SELECT current_setting'))return[{tenant:scope.tenantId,hub:scope.hubKey}];throw Object.assign(new Error('relation missing'),{code:'42P01'});}};
 await assert.rejects(()=>readExistingFacts(absent,scope),/relation missing/);
});
test('writer is server-only, parameterized and rejects absent scope before mutation',async()=>{
 let writes=0;const db={$queryRawUnsafe:async sql=>{if(sql.startsWith('SELECT current_setting'))return[{tenant:'other',hub:scope.hubKey}];writes++;return[];}};
 await assert.rejects(()=>recordFirstPublicFact(db,scope,verified,{observedAt}),/PUBLIC_ACTIVITY_SCOPE_REJECTED/);assert.equal(writes,0);
});
test('writer keeps identities in parameters and preserves evidence before the atomic index upsert',async()=>{
 const writes=[];const attack="researcher:one' OR true --";
 const db={$executeRawUnsafe:async(sql,...params)=>{writes.push({sql,params,execute:true});return 1;},$queryRawUnsafe:async(sql,...params)=>{
  if(sql.startsWith('SELECT current_setting'))return[{tenant:scope.tenantId,hub:scope.hubKey}];
  writes.push({sql,params});return[{category:'researcher'}];
 }};
 const result=await recordFirstPublicFact(db,scope,{...verified,entityKey:attack},{observedAt});
 assert.equal(result.changed,true);assert.equal(writes.length,2);
 assert.match(writes[0].sql,/INSERT INTO rh_hub_activity.evidence/);assert.equal(writes[0].execute,true);
 assert.match(writes[1].sql,/ON CONFLICT\(tenant_id,hub_key,category,entity_key\)/);
 for(const write of writes){assert.equal(write.sql.includes(attack),false);assert.equal(write.params[3],attack);}
});
