import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(new URL('../../../app/server/package.json',import.meta.url));require('ts-node').register({project:new URL('../../../app/server/tsconfig.json',import.meta.url).pathname,transpileOnly:true});
const {allowsPatientH5,allowsResearcher}=require('./src/study-operations/formal-outreach-policy.ts');
test('only an explicit well-formed patient mode on the fixed requirement enables H5',()=>{
 for(const config of [null,{}, {allowedCaptureModes:[]},{allowedCaptureModes:['researcher']},{allowedCaptureModes:'patient_h5'},{allowedCaptureModes:['patient_h5','unknown']},{allowedCaptureModes:['patient_h5','patient_h5']},{allowedCaptureModes:['clinician_rated'] }])assert.equal(allowsPatientH5(config),false);
 assert.equal(allowsPatientH5({allowedCaptureModes:['patient_h5']}),true);assert.equal(allowsPatientH5({allowedCaptureModes:['researcher','patient_h5']}),true);
});

test('researcher defaults only when modes are absent and respects explicit mode set',()=>{assert.equal(allowsResearcher(null),true);assert.equal(allowsResearcher({}),true);assert.equal(allowsResearcher({allowedCaptureModes:['patient_h5']}),false);assert.equal(allowsResearcher({allowedCaptureModes:['researcher','patient_h5']}),true);assert.equal(allowsResearcher({allowedCaptureModes:['bogus']}),false);});
