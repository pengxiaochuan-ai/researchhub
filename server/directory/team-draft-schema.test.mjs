import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateTeamDraftSchema,draftSchemaFingerprint} from '../../scripts/team-draft-schema.mjs';
test('team draft extension fails closed on column/grant/receipt drift',()=>{
 assert.equal(evaluateTeamDraftSchema({column:null,receipt:null},'sha'),'new');
 const state={column:{type:'jsonb',nullable:true,default:null},check:'check',appUpdate:true,tableUpdate:false,allowedAcl:true,otherUpdateColumns:['archived_at','team_draft','version'],fingerprint:'fingerprint',receipt:{version:2,sha256:'sha',fingerprint:'fingerprint'}};
 assert.equal(evaluateTeamDraftSchema(state,'sha'),'existing');
 for(const delta of [{column:{...state.column,type:'text'}},{appUpdate:false},{tableUpdate:true},{allowedAcl:false},{otherUpdateColumns:['team_draft','stable_key']},{receipt:null},{fingerprint:'changed'}])assert.throws(()=>evaluateTeamDraftSchema({...state,...delta},'sha'));
});
test('draft ACL fingerprint includes every grant and grant option, not only app UPDATE',()=>{
 const content={column:{type:'jsonb'},check:'check',columnAcl:'aisci_app=w/owner',tableAcl:'owner=all,aisci_app=ar'};
 for(const delta of [{columnAcl:'aisci_app=w/owner,PUBLIC=r/owner'},{columnAcl:'aisci_app=w/owner,other=a/owner'},{columnAcl:'aisci_app=w*/owner'},{tableAcl:'owner=all,aisci_app=ar,other=r'}])assert.notEqual(draftSchemaFingerprint({...content,...delta}),draftSchemaFingerprint(content));
});
