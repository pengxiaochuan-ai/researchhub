import test from 'node:test';import assert from 'node:assert/strict';
import {normalizePolicySections} from '../research-execution/policy-input.mjs';
import {ARM_VISITS} from './policy.mjs';
const population={status:'configured',source:'合成方案',reason:'模拟批准规则',rules:{schemaVersion:'population-schedule-v1',armVisitCodes:ARM_VISITS}};
const simulation={status:'configured',source:'合成方案',reason:'明确模拟时点',rules:{schemaVersion:'study-simulation-clock-v1',stageDays:[0,14,28,56],timezone:'Asia/Shanghai'}};
test('typed population and clock sections preserve frozen branches and server actor',()=>{
 const value=normalizePolicySections({populationSchedule:population,simulation},'actor',new Date('2026-11-13T00:00:00.000Z'));
 assert.deepEqual(value.populationSchedule.rules.armVisitCodes,ARM_VISITS);assert.deepEqual(value.simulation.rules.stageDays,[0,14,28,56]);assert.equal(value.simulation.decidedBy,'actor');
 for(const patch of [{...simulation,rules:{...simulation.rules,stageDays:[0,0,0,0]}},{...simulation,rules:{...simulation.rules,baseDate:'2020-01-01'}},{...simulation,decidedBy:'forged'}])assert.throws(()=>normalizePolicySections({simulation:patch},'actor',new Date()));
 assert.throws(()=>normalizePolicySections({populationSchedule:{...population,rules:{...population.rules,armVisitCodes:{...ARM_VISITS,HEALTHY_REFERENCE:['V1_HEALTHY','V2']}}}},'actor',new Date()));
});
test('ordinary policy hashes keep their previous section shape',()=>{const value=normalizePolicySections({},'actor',new Date());assert.equal(Object.hasOwn(value,'populationSchedule'),false);assert.equal(Object.hasOwn(value,'simulation'),false);});
