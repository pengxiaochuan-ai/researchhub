import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveHubAgentAvailability as availability} from '../src/hub-agent-availability.js';

test('disabled production model and consumer are unavailable rather than a session permission denial',()=>{
 const result=availability([],{enabled:false,code:'HUB_CHAT_NOT_CONFIGURED',reasons:['HUB_CHAT_MODEL_NOT_CONFIGURED','HUB_CHAT_MODEL_DISABLED','HUB_CHAT_CONSUMER_DISABLED']});
 assert.equal(result.kind,'unavailable');assert.match(result.message,/暂未启用/);assert.doesNotMatch(result.message,/没有.*权限/);
});
test('a true access denial stays restricted even when the model is also disabled',()=>{
 assert.equal(availability([],{enabled:false,code:'HUB_CHAT_NOT_CONFIGURED',reasons:['HUB_CHAT_ACCESS_NOT_GRANTED','HUB_CHAT_MODEL_DISABLED']}).kind,'restricted');
});
test('unconfigured agent and disabled model never unlock the composer from a stale agent list',()=>{
 assert.equal(availability([{id:'old',type:'research'}],{enabled:false,code:'HUB_CHAT_NOT_CONFIGURED',reasons:['HUB_CHAT_AGENT_NOT_CONFIGURED']}).kind,'unavailable');
});
test('a ready research agent retains its actual quota and upload limits',()=>{
 const quota={blocked:true},materialUpload={enabled:false};assert.deepEqual(availability([{id:'other',type:'diagnosis'},{id:'current',type:'research'}],{enabled:true,quota,materialUpload}),{kind:'ready',agentId:'current',quota,materialUpload});
});
test('older local status without an enabled field still resolves the authorized research agent',()=>{
 assert.equal(availability([{id:'local',type:'research'}],{quota:{blocked:false}}).agentId,'local');
 assert.equal(availability([],{enabled:true}).kind,'restricted');
});
test('an unknown explicitly disabled status cannot unlock a stale agent',()=>{
 assert.equal(availability([{id:'old',type:'research'}],{enabled:false,code:'TEMPORARILY_UNAVAILABLE',reasons:null}).kind,'unavailable');
});
