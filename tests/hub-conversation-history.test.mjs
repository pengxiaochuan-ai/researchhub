import test from 'node:test';
import assert from 'node:assert/strict';
import * as history from '../scripts/hub-conversation-history.mjs';
test('history request is paginated and constrained to own active scope and Hub channel',()=>{
 assert.equal(typeof history.hubHistoryQuery,'function');
 const user={tenantId:'t',accountId:'a',studyGroupId:'g',researchProjectId:'p'};
 const q=history.hubHistoryQuery(user,'agent',{page:'2',limit:'20'});
 assert.equal(q.where.accountId,'a');assert.equal(q.where.tenantId,'t');assert.equal(q.where.studyGroupId,'g');assert.equal(q.where.researchProjectId,'p');assert.equal(q.where.agentId,'agent');assert.equal(q.where.deletedAt,null);assert.equal(q.where.channel,'knowledge');assert.equal(q.skip,20);assert.equal(q.take,21);
 for(const query of [{page:'0'},{limit:'51'},{page:'1.5'},{unexpected:'x'}])assert.throws(()=>history.hubHistoryQuery(user,'agent',query));
});
test('history projection does not leak context keys or payloads; malformed article contexts rejected',()=>{
 const item={id:'s',title:'本人问题',contextKey:'hub:lingshu-xinyu',updatedAt:'now',payload:{secret:true}};
 const p=history.projectHubHistory(item);assert.deepEqual(p,{id:'s',title:'本人问题',manuallyNamed:false,pinned:false,updatedAt:'now',hasPrompt:false,kind:'hub'});
 assert.throws(()=>history.projectHubHistory({...item,contextKey:'hub-article:forged'}));
 assert.throws(()=>history.projectHubHistory({...item,contextKey:'kb:private'}));
});
test('existing histories derive titles from the first real user input without returning message metadata',()=>{
 const item={id:'s',title:'新对话',contextKey:'hub:lingshu-xinyu',updatedAt:'now',messages:[{content:'修改后的问题',meta:{hubCommand:{originalText:'首条真实问题的完整内容'},secret:'must-not-leak'}}]};
 const p=history.projectHubHistory(item);assert.equal(p.title,'首条真实问题的完整内容');assert.equal(p.hasPrompt,true);assert(!('messages'in p));assert(!JSON.stringify(p).includes('must-not-leak'));
 const q=history.hubHistoryQuery({tenantId:'t',accountId:'a',studyGroupId:'g',researchProjectId:'p'},'agent');assert.equal(q.select.messages.take,1);assert.equal(q.select.messages.where.role,'user');assert.equal(q.select.messages.where.tenantId,'t');
});
