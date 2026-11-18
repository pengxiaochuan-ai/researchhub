import test from 'node:test';import assert from 'node:assert/strict';
const api=await import('../src/agent-history-timeline.js').catch(()=>({}));
test('calendar groups are exclusive at today/yesterday/7/30-day boundaries and retain monthly references',()=>{
 assert.equal(typeof api.groupAgentHistory,'function');
 const now=new Date(2026,10,11,12),items=[0,1,2,6,7,29,30,31,70].map(n=>({id:String(n),updatedAt:new Date(2026,10,11-n,23).toISOString()}));
 const groups=api.groupAgentHistory(items,now);
 assert.deepEqual(groups.map(g=>[g.label,g.items.map(i=>i.id)]),[['今天',['0']],['昨天',['1']],['7天内',['2','6']],['30天内',['7','29']],['2026-10',['30','31']],['2026-09',['70']]]);
 assert.equal(new Set(groups.flatMap(g=>g.items.map(i=>i.id))).size,items.length);
 const year=api.groupAgentHistory([{id:'old',updatedAt:new Date(2025,11,31,23).toISOString()}],new Date(2026,0,1,0,1));assert.equal(year[0].label,'昨天');
 assert.equal(api.groupAgentHistory([{id:'bad',updatedAt:'invalid'}],now)[0].label,'时间未知');
});
test('twelve visible characters stay single-line without cutting composed Unicode characters',()=>{
 assert.equal(typeof api.agentHistoryTitle,'function');
 assert.equal(api.agentHistoryTitle('  一二三四五六七八九十一二三\n四五  '),'一二三四五六七八九十一二');
 assert.equal(api.agentHistoryTitle('👩‍⚕️'.repeat(13)),'👩‍⚕️'.repeat(12));
 assert.equal(api.agentHistoryTitle('短问题'),'短问题');assert.equal(api.agentHistoryTitle(''),'新对话');assert.equal(api.agentHistoryTitle('第一行\n第二行'),'第一行 第二行');
});
test('an accepted first command updates only its own row and cannot replace an established title or remove pages',()=>{
 assert.equal(typeof api.applyHistoryCommand,'function');
 const items=[{id:'new',title:'新对话',hasPrompt:false,updatedAt:'2026-11-10T00:00:00Z'},{id:'other',title:'另一个会话',hasPrompt:true}];
 const first={sessionId:'new',text:'刚发送的首个问题',createdAt:'2026-11-11T00:00:00Z'};
 const next=api.applyHistoryCommand(items,first);assert.equal(next[0].title,first.text);assert.equal(next[0].updatedAt,first.createdAt);assert.equal(next[1],items[1]);
 assert.equal(api.applyHistoryCommand(next,{...first,text:'第二条问题'})[0].title,first.text);
 assert.equal(api.applyHistoryCommand(items,{...first,sessionId:'unknown'}).length,2);
});
