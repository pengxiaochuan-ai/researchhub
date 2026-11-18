import test from 'node:test';import assert from 'node:assert/strict';import {sameTeamDraft} from '../src/team-draft-equality.js';
test('selecting the same institution/location again does not mark a draft dirty solely due to JSONB key order',()=>{
 assert(sameTeamDraft({name:'甲',location:{version:'MCA-2024-12-31',cityCode:'110000',provinceCode:'110000'}},{location:{provinceCode:'110000',cityCode:'110000',version:'MCA-2024-12-31'},name:'甲'}));
 assert(!sameTeamDraft({members:['a','b']},{members:['b','a']}));assert(!sameTeamDraft({city:'北京'},{city:'北京市'}));
});
