import test from 'node:test';import assert from 'node:assert/strict';
import {referenceSchemaFingerprint,evaluateReferenceState,referenceSchemaHash} from '../../scripts/reference-divisions-schema.mjs';
import {SOURCE_SHA256} from './divisions.mjs';
test('column ACL and inherited/effective write permission drift cannot share the accepted fingerprint',()=>{
 const a={objects:[],columns:[],constraints:[],acl:{acl:'read-only'},columnAcls:[{name:'name',acl:null}],columnRights:[{name:'name',read:true,insert:false,update:false,references:false}]};
 const b={...a,columnAcls:[{name:'name',acl:'{aisci_app=w/owner}'}]};assert.notEqual(referenceSchemaFingerprint(a),referenceSchemaFingerprint(b));
 assert.notEqual(referenceSchemaFingerprint(a),referenceSchemaFingerprint({...a,columnRights:[{...a.columnRights[0],update:true}]}));
 const fingerprint=referenceSchemaFingerprint(a),state={present:true,readOnly:true,fingerprint,receipt:{version:2,schemaHash:referenceSchemaHash,sourceSha:SOURCE_SHA256,fingerprint}};
 assert.equal(evaluateReferenceState(state),'existing');assert.throws(()=>evaluateReferenceState({...state,readOnly:false}));assert.throws(()=>evaluateReferenceState({...state,fingerprint:referenceSchemaFingerprint(b)}));
 assert.throws(()=>evaluateReferenceState({...state,receipt:{...state.receipt,version:1}}));
});
