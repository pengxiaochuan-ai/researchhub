import test from 'node:test';
import assert from 'node:assert/strict';
import {runtimeDependencies} from '../research-runtime/dependencies.mjs';
import {createSimulationProtocolAdapter} from './protocol-core-adapter.mjs';
test('protocol reference extension is private to its service instance graph',()=>{
 const deps=runtimeDependencies(),Legacy=deps.load('study-operations/study-operations.service','StudyOperationsService');
 const check=deps.load('study-operations/protocol-fixed-references','checkProtocolFixedReferences');
 const first=createSimulationProtocolAdapter({...deps,resolveCase:async()=>null}),second=createSimulationProtocolAdapter({...deps,resolveCase:async()=>null});
 assert.notEqual(first.load('study-operations/study-operations.service','StudyOperationsService'),Legacy);
 assert.notEqual(first.load('study-operations/study-operations.service','StudyOperationsService'),second.load('study-operations/study-operations.service','StudyOperationsService'));
 assert.equal(deps.load('study-operations/study-operations.service','StudyOperationsService'),Legacy);
 assert.equal(deps.load('study-operations/protocol-fixed-references','checkProtocolFixedReferences'),check);
});
