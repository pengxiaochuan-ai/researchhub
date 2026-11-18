import test from 'node:test';import assert from 'node:assert/strict';import {presentOutreachVisit} from './outreach-display.mjs';
test('visit adds only the latest safe invitation locator for its scoped H5 assignments',async()=>{
 const scope={tenantId:'tenant',studyGroupId:'group',researchProjectId:'project'};let args;
 const tx={questionnaireInvitation:{findMany:async input=>(args=input,[{id:'new',assignmentId:'h5'},{id:'old',assignmentId:'h5'}])}};
 const visit={id:'visit',assignments:[{id:'h5',mode:'patient_h5'},{id:'onsite',mode:'researcher'}]};const value=await presentOutreachVisit(tx,scope,visit);
 assert.deepEqual(args.where,{...scope,assignmentId:{in:['h5']},deliveries:{some:{channel:'email'}}});assert.deepEqual(args.select,{id:true,assignmentId:true});assert.deepEqual(value.assignments[0].emailInvitation,{invitationId:'new'});assert(!value.assignments[1].emailInvitation);assert(!visit.assignments[0].emailInvitation);
});
