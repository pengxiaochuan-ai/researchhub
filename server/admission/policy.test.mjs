import {test} from 'node:test';
import assert from 'node:assert/strict';
import {transition,decisionInput,submissionInput,registrationMaterial,requestHash,admissionException} from './policy.mjs';

test('pending approval and exceptional missing information are distinct transitions',()=>{
 assert.equal(transition('pending','approve'),'approved');
 assert.equal(transition('pending','needs_information'),'needs_information');
 assert.equal(transition('needs_information','supplement'),'pending');
 assert.equal(transition('rejected','resubmit'),'pending');
 for(const [state,action] of [['approved','resubmit'],['pending','supplement'],['rejected','approve']])assert.throws(()=>transition(state,action),e=>e.status===409);
});
test('approval requires no boilerplate, negative decisions require concrete reasons',()=>{
 const base={baseRevision:1,requestKey:'request-key-0001'};
 assert.equal(decisionInput({...base,action:'approve'}).reason,'');
 assert.throws(()=>decisionInput({...base,action:'reject',reason:'  '}));
 assert.throws(()=>decisionInput({...base,action:'approve',role:'tenant_admin'}));
 assert.throws(()=>decisionInput({...base,action:'approve',baseRevision:0}));
 assert.throws(()=>decisionInput({...base,action:'needs_information',reason:'x'.repeat(501)}));
 assert.equal(submissionInput({...base,action:'supplement',text:'具体补充'}).text,'具体补充');
 assert.equal(decisionInput({...base,action:'reject',reason:'不符',allowResubmit:true}).allowResubmit,true);
 assert.throws(()=>decisionInput({...base,action:'approve',allowResubmit:true}));
 assert.throws(()=>submissionInput({...base,action:'supplement',text:' ',email:'other@example.org'}));
});
test('registration snapshot uses only verified original fields and excludes secrets',()=>{
 const m=registrationMaterial({id:'account-1',displayName:'研究者',emailNormalized:'r@example.org',password:'secret',token:'secret'});
 assert.deepEqual(m,{displayName:'研究者',email:'r@example.org'});
 assert.equal(requestHash({a:1}),requestHash({a:1}));
});
test('only exact self-service routes are exempt from business admission',()=>{
 for(const [method,path] of [['GET','/api/auth/me'],['PATCH','/api/account-access/profile'],['GET','/api/hubs/lingshu/admission'],['POST','/api/hubs/lingshu/admission/submissions']])assert.equal(admissionException(method,path,'lingshu'),true);
 for(const [method,path] of [['POST','/api/account-access/profile'],['GET','/api/hubs/other/admission'],['GET','/api/hubs/lingshu/admissions'],['POST','/api/member-invitation-acceptances'],['GET','/api/hubs/lingshu/admission/extra'],['GET','/api/knowledge/bases']])assert.equal(admissionException(method,path,'lingshu'),false);
});
