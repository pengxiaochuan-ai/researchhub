import test from'node:test';import assert from'node:assert/strict';
import{crfAiFixture}from'../tests/fixtures/synthetic-crf-methods-ai.mjs';
import{createRequire}from'node:module';
import{edcDigest}from'./synthetic-edc-contract.mjs';
const snapshot=(view,ids)=>{const body={evidenceIds:ids,baseRunVersion:view.runVersion,resultHash:view.resultHash,requestKey:'test-request-123'};const{resultHash,...rest}=body;return{...rest,requestHash:edcDigest(body)};};
const a=await import('./synthetic-crf-methods-ai-contract.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const ready=()=>assert.equal(typeof a.crfInterpretationBinding,'function','CRF AI contract missing');
test('five_payload_families_exclusive: malformed fifth intent cannot become Q&A',()=>{
 ready();const{view,ids}=crfAiFixture(),binding=a.crfInterpretationBinding(view,ids),payload=a.bindCrfMethodsTask({},binding,snapshot(view,ids));
 assert.deepEqual(a.crfMethodsTask(payload).binding,binding);
 for(const key of ['researchPlan','researchDesign','researchExecutionPreparation','researchSyntheticEdc']){assert.throws(()=>a.crfMethodsTask({...payload,[key]:{}}));assert.throws(()=>a.bindCrfMethodsTask({[key]:{}},binding));assert.equal(a.crfMethodsTask({[key]:{}}),null);}
 for(const bad of [null,undefined,{}, {kind:'other',binding},{kind:'result_interpretation',binding:{...binding,runId:null}}])assert.throws(()=>a.crfMethodsTask({researchCrfMethods:bad}));
 for(const ids of [[],['fake'],['crfg_abc123','crfg_abc123']])assert.throws(()=>a.crfInterpretationBinding(view,ids));
});
test('job retains immutable ordered evidence selection and request version without mutable run metadata',()=>{
 const{view,ids}=crfAiFixture(),binding=a.crfInterpretationBinding(view,ids),request=snapshot(view,ids),task=a.bindCrfMethodsTask({},binding,request).researchCrfMethods;
 assert.deepEqual(task.evidenceIds,ids);assert.equal(task.requestKey,'test-request-123');assert.equal(task.baseRunVersion,request.baseRunVersion);
 for(const patch of [{evidenceIds:[]},{evidenceIds:[...ids].reverse()},{evidenceIds:[ids[0],ids[0]]},{requestHash:'a'.repeat(64)},{requestKey:'another-key'},{baseRunVersion:'2026-10-25T15:00:00.000Z'},{extra:true}])assert.throws(()=>a.crfMethodsTask({researchCrfMethods:{...task,...patch}}));
 assert.throws(()=>a.crfMethodsTask({researchCrfMethods:{kind:'result_interpretation',binding}}));
});
test('no_numeric_or_raw_input_to_model across method view and extracted KB prose',()=>{
 ready();const f=crfAiFixture(),v=a.crfInterpretationModel(f.view,f.ids,f.packet.config,f.pico,f.sources),text=JSON.stringify(v);
 for(const forbidden of ['RAW_RECORD','0.333333','configuredBound','numericEvidence','rangeLocations','三十','30','"n":','"value":','"answers"'])assert(!text.includes(forbidden),forbidden);
 assert.equal(v.methodRefs[0].range,'outside_manual_range');assert.equal(v.methodRefs[1].range,'not_examined_all_missing');assert(v.knowledge[0].quote.includes('合成资料仅用于软件验证。'));assert(!v.knowledge[0].quote.includes('样本量'));
 const none=a.crfInterpretationModel(f.view,f.ids,f.packet.config,f.pico,[{quote:'30例。'}]);assert.equal(none.knowledge[0].available,false);
});
test('method_and_knowledge_refs_never_confused and actual narrative references match exactly',()=>{
 ready();const f=crfAiFixture(),trusted={...f,config:f.packet.config,modelView:a.crfInterpretationModel(f.view,f.ids,f.packet.config,f.pico,f.sources)},item={evidenceIds:[f.ids[0]],explanation:'此处记录存在缺失，需要核对适用范围。[M1][1]',question:'是否需要由研究者核对原记录？[M1]',sourceRefs:[{kind:'method',index:1},{kind:'knowledge',index:1}]};
 assert.deepEqual(a.parseCrfMethodInterpretation(JSON.stringify({items:[item]}),trusted),{items:[item]});
 const methodOnly={...item,explanation:'当前仅有人工范围观察，不表示疗效结论。[M1]',question:'',sourceRefs:[{kind:'method',index:1}]};assert(a.parseCrfMethodInterpretation(JSON.stringify({items:[methodOnly]}),trusted));
 for(const bad of [{...item,evidenceIds:['fake']},{...item,sourceRefs:[{kind:'knowledge',index:1}]},{...item,explanation:'未知方法[M2][1]'},{...item,explanation:'共三十名。[M1][1]'},{...item,explanation:'缺失率为0.333333。[M1][1]'},{...item,explanation:'立即修改配置。[M1][1]'},{...item,patch:{}},{...item,question:'请补充'}])assert.throws(()=>a.parseCrfMethodInterpretation(JSON.stringify({items:[bad]}),trusted));
 assert.throws(()=>a.parseCrfMethodInterpretation(JSON.stringify({items:Array(7).fill(item)}),trusted));
});
test('both provider paths replace legacy unsafe text, retain tool limits and use JSON only on supported synthesis API',()=>{
 ready();const f=crfAiFixture(),turn={crf:{...f,config:f.packet.config,modelView:a.crfInterpretationModel(f.view,f.ids,f.packet.config,f.pico,f.sources)},toolExecuted:true};
 const messages=a.crfProviderMessages(turn,[{role:'system',content:'UNSAFE 9281'},{role:'user',content:'RAW_ANSWERS 9281'}]);assert(!JSON.stringify(messages).includes('9281'));assert(!JSON.stringify(messages).includes('UNSAFE'));
 assert.equal(a.crfProviderOptions(turn,{signal:'original'},false).jsonMode,true);assert.equal(a.crfProviderOptions(turn,{signal:'original'},true).signal,'original');assert(!Object.hasOwn(a.crfProviderOptions(turn,{},true),'jsonMode'));
 const require=createRequire(new URL('../../app/server/package.json',import.meta.url)),{shouldUseKbAnswerFastPath}=require('./src/orchestrator/kb-agent-performance-policy.ts');assert(shouldUseKbAnswerFastPath({message:a.CRF_AI_REQUEST_TEXT,currentKbId:'kb',canSearch:true,hasAttachments:false}));
});
test('actual Provider input maps each selected method to its required inline token without inventing literature refs',()=>{
 const f=crfAiFixture(),turn={crf:{...f,modelView:a.crfInterpretationModel(f.view,f.ids,f.packet.config,f.pico,[{quote:'30例。'}])}};
 const messages=a.crfProviderMessages(turn),user=JSON.parse(messages[1].content.split('可信定性方法与非数值摘录：')[1]);
 assert.deepEqual(user.outputRequirements.methodCitations,[{evidenceId:'crfg_abc123',inlineToken:'[M1]',sourceRef:{kind:'method',index:1}},{evidenceId:'crfg_def456',inlineToken:'[M2]',sourceRef:{kind:'method',index:2}}]);assert.deepEqual(user.outputRequirements.availableKnowledgeCitations,[]);assert.equal(user.outputRequirements.autoRepairAllowed,false);
 assert(!JSON.stringify(messages).includes('0.333333'));assert(!JSON.stringify(messages).includes('RAW_RECORD'));
});
test('English quantities and Unicode numerals cannot enter any model prose or pass accepted explanations',()=>{
 const f=crfAiFixture();
 for(const value of ['Thirty synthetic participants','one third','half','two-thirds','a dozen','⅓','½','²','Ⅳ','𝟛']){
  const view=structuredClone(f.view);view.result.evidenceGroups[0].visitLabel=value;view.result.evidenceGroups[0].fieldLabel=value;
  const model=a.crfInterpretationModel(view,f.ids,f.packet.config,{p:value},[{quote:'安全合成上下文。'+value+'。'}]);
  assert(!JSON.stringify(model).includes(value),'quantity leaked to Provider: '+value);assert(model.knowledge[0].quote.includes('安全合成上下文。'));
  const trusted={...f,config:f.packet.config,modelView:model};
  assert.throws(()=>a.parseCrfMethodInterpretation(JSON.stringify({items:[{evidenceIds:[f.ids[0]],explanation:value+'[M1]',question:'',sourceRefs:[{kind:'method',index:1}]}]}),trusted),e=>e.message==='CRF_AI_NUMERIC_REJECTED',value);
 }
 const model=a.crfInterpretationModel(f.view,f.ids,f.packet.config,{p:'another participant needs qualitative review'},[]),trusted={...f,config:f.packet.config,modelView:model};assert.equal(model.researchIntent.p,'another participant needs qualitative review');
 assert(a.parseCrfMethodInterpretation(JSON.stringify({items:[{evidenceIds:[f.ids[0]],explanation:'核对技术组 '+f.ids[0]+' 的人工范围观察。[M1]',question:'',sourceRefs:[{kind:'method',index:1}]}]}),trusted));
});
