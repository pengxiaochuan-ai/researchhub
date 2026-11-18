import test from 'node:test';import assert from 'node:assert/strict';
import {dispatchStudyService} from './local-full-study-simulation.mjs';
test('configuration dispatch never returns an ordinary study hint before its current scope authority',async()=>{
 const calls=[],service=dispatchStudyService({admission:{isTarget:id=>id==='admitted'},primary:{configuration:async()=>({schemaVersion:'full-study-simulation-v2'})},ordinaryConfiguration:async(user,studyId)=>{calls.push(studyId);if(user?.allowed!==true)throw Object.assign(Error('denied'),{status:403});return{studyId,schemaVersion:'t15-synthetic-plan-v1'};}});
 await assert.rejects(service.configuration({allowed:false},'foreign'),e=>e.status===403);assert.equal((await service.configuration({allowed:true},'ordinary')).schemaVersion,'t15-synthetic-plan-v1');assert.equal((await service.configuration({},'admitted')).schemaVersion,'full-study-simulation-v2');assert.deepEqual(calls,['foreign','ordinary']);
});
