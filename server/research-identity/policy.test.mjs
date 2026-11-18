import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProfileChanges,emptyResearchProfile,parseProfileCommand,assertEstablishable} from './policy.mjs';

test('optional empty drafts stay valid but establishment requires name and a direction',()=>{
  const p=normalizeProfileChanges({},null);assert.deepEqual(p,emptyResearchProfile());
  assert.throws(()=>assertEstablishable(p),e=>e.status===422&&Boolean(e.fieldErrors.researchName));
  const full=normalizeProfileChanges({researchName:' 合成研究员 ',researchDirections:[' 针灸 ']},p);
  assert.equal(full.researchName,'合成研究员');assert.deepEqual(full.researchDirections,['针灸']);assert.doesNotThrow(()=>assertEstablishable(full));
});
test('unknown nested fields and privilege or verification properties cannot be saved',()=>{
  for(const changes of [{level:'L3'},{role:'tenant_admin'},{isVerified:true},{verificationPreparation:{reviewer:'admin'}},{affiliationClaims:[{claimId:'x',organizationName:'合成机构',verified:true}]}])assert.throws(()=>normalizeProfileChanges(changes,null),e=>e.status===400);
});
test('omitted values persist, explicit null clears optional values and arrays replace',()=>{
  const p=normalizeProfileChanges({researchName:'甲',biography:'经历',researchDirections:['方向一','方向二']},null);
  const n=normalizeProfileChanges({biography:null,researchDirections:['新方向']},p);
  assert.equal(n.researchName,'甲');assert.equal(n.biography,'');assert.deepEqual(n.researchDirections,['新方向']);assert.equal(p.biography,'经历');
});
test('ORCID checksum and safe public links are validated without treating them as certification',()=>{
  assert.equal(normalizeProfileChanges({orcid:'0000-0002-1825-0097'},null).orcid,'0000-0002-1825-0097');
  assert.throws(()=>normalizeProfileChanges({orcid:'0000-0002-1825-0098'},null),e=>e.status===422);
  for(const url of ['http://example.org','javascript:alert(1)','https://user:pass@example.org/','https://127.0.0.1/private'])assert.throws(()=>normalizeProfileChanges({publicHomepages:[url]},null),e=>e.status===422);
});
test('affiliation claims remain self declarations with bounded ordered dates',()=>{
  const a={claimId:'claim-1',organizationName:'合成研究所',department:'科室',positionTitle:'研究员',startMonth:'2020-01',endMonth:null};
  assert.equal(normalizeProfileChanges({affiliationClaims:[a]},null).affiliationClaims[0].organizationName,'合成研究所');
  assert.throws(()=>normalizeProfileChanges({affiliationClaims:[{...a,endMonth:'2019-12'}]},null),e=>e.status===422);
  assert.throws(()=>normalizeProfileChanges({affiliationClaims:[a,a]},null),e=>e.status===422);
});
test('collection and UTF-8 limits reject oversized drafts instead of silently truncating',()=>{
  assert.throws(()=>normalizeProfileChanges({researchDirections:Array.from({length:11},(_,i)=>'方向'+i)},null),e=>e.status===422);
  assert.throws(()=>normalizeProfileChanges({biography:'中'.repeat(2001)},null),e=>e.status===422);
});
test('profile command only admits CAS and UUID request keys, never client account IDs',()=>{
  const body={expectedVersion:0,requestKey:'0d572d1c-365b-48b2-8a0f-8c5f8a0c2c89',changes:{researchName:'甲'}};
  assert.equal(parseProfileCommand('save',body).expectedVersion,0);
  for(const changes of [{accountId:'other'},{expectedVersion:-1},{requestKey:'not-a-uuid'}])assert.throws(()=>parseProfileCommand('save',{...body,...changes}),e=>e.status===400);
  assert.throws(()=>parseProfileCommand('establish',body),e=>e.status===400);
});
