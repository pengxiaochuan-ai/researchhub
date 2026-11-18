import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {parsePicoCandidate,confirmPico,parsePlanCandidate,stageRequestText,stagePrompt,assertDraftBinding,bindPlanHits,editablePlanContent} from './research-plan-contract.mjs';
import * as contract from './research-plan-contract.mjs';
test('bound plan stages revalidate the same fixed topic retrieval query as creation, never a looser threshold or replacement source',()=>{assert.equal(typeof contract.planRetrievalQuery,'function');const fixed='当前合成资料的研究人群、针灸干预、对照、结局与研究限制';for(const stage of ['pico','protocol'])assert.equal(contract.planRetrievalQuery(stageRequestText(stage),true),fixed);assert.equal(contract.planRetrievalQuery('普通问答原问题',false),'普通问答原问题');assert.throws(()=>bindPlanHits([{chunkId:'other'}],[{chunkId:'fixed'}]));});
test('PICO prompt exposes the existing bounded unknown-list contract before a paid call',()=>{assert.match(stagePrompt('pico'),/unknowns.*最多6项/);assert.throws(()=>parsePicoCandidate(JSON.stringify({...candidate,unknowns:Array.from({length:14},()=> '缺少研究安排')}),sources),/SCHEMA/);});
const sources=[{docId:'d',version:3,quote:'合成材料拟探索针灸辅助常规治疗成人抑郁障碍，对照、结局和时间待研究者确认。'}];
const candidate={question:'针灸辅助常规治疗是否有研究可行性？',p:'成人抑郁障碍',i:'针灸辅助常规治疗',c:null,o:null,rationale:'仅可讨论研究构想 [1]。',unknowns:['对照','结局及时间']};
test('generated provenance is not editable body and never swallows a revision appended after its footer',()=>{
 const footer='\n\n<!-- rh-plan-provenance -->\n\n## 来源与确认记录\n\n仅限合成研究候选；来源快照不代表正式方法学确认。\n\n[1] 来源\n\nPICO确认：尚未确认\n\n上下文SHA256：'+'a'.repeat(64);
 for(const end of ['', '\n<!-- /rh-plan-provenance -->'])assert.equal(editablePlanContent('正文'+footer+end+'\n\n用户追加'), '正文\n\n用户追加');
 assert.equal(editablePlanContent('正文\n\n正常用户注释 <!-- custom -->'), '正文\n\n正常用户注释 <!-- custom -->');
});
test('bounded read-only stages use the original deterministic retrieval path, with confirmed PICO kept in trusted context',()=>{
 const require=createRequire(new URL('../../app/server/package.json',import.meta.url));require('ts-node').register({project:new URL('../../app/server/tsconfig.json',import.meta.url).pathname,transpileOnly:true});
 const {shouldUseKbAnswerFastPath}=require('../../app/server/src/orchestrator/kb-agent-performance-policy.ts');
 for(const stage of ['pico','protocol'])assert.equal(shouldUseKbAnswerFastPath({message:stageRequestText(stage),currentKbId:'kb',canSearch:true,hasAttachments:false}),true);
 const pico={p:'成人',i:'辅助针灸',c:'常规治疗',o:'症状变化',question:'是否可行？'};
 assert.ok(stagePrompt('protocol',pico).includes(JSON.stringify(pico)));
 assert.match(stagePrompt('protocol',pico),/不得.*替换/);
});
test('each stage keeps the selected material set and citation order, never silently swaps sources',()=>{
 const fixed=[{chunkId:'a'},{chunkId:'b'}],hits=[{chunkId:'b'},{chunkId:'new'},{chunkId:'a'}];
 assert.deepEqual(bindPlanHits(hits,fixed).map(h=>h.chunkId),['a','b']);
 assert.throws(()=>bindPlanHits([{chunkId:'b'}],fixed),/SOURCE_SET/);
});
test('PICO schema keeps missing fields null and only binds real citations',()=>{
 const p=parsePicoCandidate('```json\n'+JSON.stringify(candidate)+'\n```',sources);assert.equal(p.c,null);assert.equal(p.o,null);
 assert.throws(()=>parsePicoCandidate(JSON.stringify({...candidate,rationale:'依据 [2]'}),sources),/CITATION/);
 assert.throws(()=>parsePicoCandidate(JSON.stringify({...candidate,extra:'不接受任意字段'}),sources),/SCHEMA/);
 assert.throws(()=>parsePicoCandidate(JSON.stringify({...candidate,p:'18岁以上患者'}),sources),/NUMERIC/);
});
test('human PICO confirmation requires all fields and records a deterministic hash',()=>{
 assert.throws(()=>confirmPico(candidate),/INCOMPLETE/);
 const input={question:candidate.question,p:candidate.p,i:candidate.i,c:'常规治疗',o:'抑郁症状变化（评估时点由后续方案确认）'};
 const confirmed=confirmPico(input);assert.deepEqual(confirmed.values,input);assert.match(confirmed.hash,/^[a-f0-9]{64}$/);assert.equal(confirmPico({...input}).hash,confirmed.hash);
 assert.throws(()=>confirmPico({...input,c:'待确认'}),/INCOMPLETE/);
});
test('protocol suggestion is fed through the actual old candidate-outline builder, no scientific numbers',()=>{
 const require=createRequire(new URL('../../app/server/package.json',import.meta.url));require('ts-node').register({project:new URL('../../app/server/tsconfig.json',import.meta.url).pathname,transpileOnly:true});
 const{buildResearchStudyPlanDraft}=require('../../app/server/src/research-evidence/research-study-plan.ts');
 const pico=confirmPico({question:candidate.question,p:candidate.p,i:candidate.i,c:'常规治疗',o:'症状变化'}).values;
 const model={title:'针灸辅助抑郁障碍研究候选',hypothesis:'针灸辅助方案可能具有研究可行性 [1]。',design:'随机化方式、随访与研究设计类型仍待确认 [1]。',limitations:['资料证据局限：合成资料不是真实临床证据 [1]。']};
 const plan=parsePlanCandidate(JSON.stringify(model),sources,pico,buildResearchStudyPlanDraft);
 assert.equal(plan.outline.status,'candidate_outline');assert.equal(plan.outline.numericAuthority,'research_method_run_only');assert.deepEqual(plan.outline.methodRunRefs,[]);assert.ok(plan.outline.unresolvedMethodParameters.includes('检验效能与样本量'));
 assert.equal(plan.outline.design.type,'requires_methodologist_confirmation');assert.doesNotMatch(plan.outline.design.populationFrame,/随机分配/);assert.ok(plan.outline.unresolvedMethodParameters.includes('研究设计类型与估计目标'));assert.equal(plan.outline.design.summary,model.design);
 assert.throws(()=>parsePlanCandidate(JSON.stringify({...model,hypothesis:'预计改善20% [1]。'}),sources,pico,buildResearchStudyPlanDraft),/NUMERIC/);
});
test('only exact owned local candidate binding and confirmed PICO version can execute a stage',()=>{
 const binding={artifactId:'a',version:4,stage:'protocol',confirmationHash:'h'},current={id:'a',currentVersionNo:4,stage:'pico_confirmed',confirmation:{hash:'h'}};
 assert.doesNotThrow(()=>assertDraftBinding(binding,current));
 for(const c of [{...current,currentVersionNo:5},{...current,id:'foreign'},{...current,confirmation:null}])assert.throws(()=>assertDraftBinding(binding,c),/BINDING/);
 assert.equal(stageRequestText('pico').length<1000,true);assert.throws(()=>stageRequestText('release'),/STAGE/);
});
