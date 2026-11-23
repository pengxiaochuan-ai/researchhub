import assert from 'node:assert/strict';
import test from 'node:test';
import {recordExternalPublicApproval} from './external-event.mjs';

const scope={tenantId:'test',hubKey:'lingshu-xinyu'};
const event={documentId:'rhed-synthetic',decisionVersion:9n,createdAt:new Date('2026-11-23T06:00:00Z')};

function fixture({documentType='clinical_registry', previouslyApproved=false, reviewVersion='9', installed=true}={}) {
  const db={
    async $queryRaw(strings) {
      if (strings.join('').includes('to_regclass')) return [{installed}];
      return [{previously_approved:previouslyApproved}];
    },
    async $executeRaw() { return 1; },
  };
  const facts=[];
  const dependencies={
    readHub:async()=>true,
    readPublic:async()=>[{documentId:event.documentId,documentType,externalKey:'chictr1234',reviewVersion}],
    write:async(tx,actualScope,fact)=>{assert.equal(tx,db);assert.equal(actualScope,scope);facts.push(fact);},
  };
  return {facts,run:()=>recordExternalPublicApproval(db,scope,event,dependencies)};
}

test('new public clinical and guidance approvals retain review timestamp and canonical identity',async()=>{
  for (const [documentType,category,entityKey] of [
    ['clinical_registry','registration','registry:chictr:CHICTR1234'],
    ['clinical_guideline','guidance','external:rhed-synthetic'],
    ['research_standard','guidance','external:rhed-synthetic'],
  ]) {
    const {run,facts}=fixture({documentType});
    await run();
    assert.deepEqual(facts,[{category,entityKey,firstPublicAt:event.createdAt,timeStatus:'verified',
      proofRefs:['external-display-review:9'],ruleVersion:'external-public-approval.v1'}]);
  }
});

test('historical restoration, unprojectable decisions and missing index do not assign a first date',async()=>{
  for (const scenario of [{previouslyApproved:true},{reviewVersion:'8'},{installed:false}]) {
    const {run,facts}=fixture(scenario);
    await run();
    assert.deepEqual(facts,[]);
  }
});
