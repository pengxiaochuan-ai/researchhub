import {test} from 'node:test';import assert from 'node:assert/strict';
import {registrationEntryTarget,uncertainRegistration} from '../src/registration-admission.js';
test('signed-in join entry uses the existing application without registering or overwriting identities',()=>{
 const user={accountId:'actor'};assert.equal(registrationEntryTarget(user,{accountId:'actor',status:'pending'}),'/pages/p006/?section=admission');
 assert.equal(registrationEntryTarget(user,{accountId:'actor',status:'approved'}),'/pages/p01/');
 assert.equal(registrationEntryTarget(null,null),null);
 assert.equal(registrationEntryTarget(user,null,{verificationLink:true}),null);
 assert.throws(()=>registrationEntryTarget(user,{accountId:'other',status:'approved'}));
 assert.throws(()=>registrationEntryTarget(user,null));
});
test('unknown registration is a login-and-read recovery, not another registration',()=>{
 for(const error of [{code:'WP02_NETWORK'},{code:'WP02_INVALID_RESPONSE'},{code:'WP02_UNAVAILABLE',status:503}])assert.equal(uncertainRegistration(error),true);
 for(const error of [{code:'WP02_SEATS_FULL',status:409},{code:'WP02_INVALID_TOKEN',status:400},{code:'WP02_RATE_LIMITED',status:429}])assert.equal(uncertainRegistration(error),false);
});
