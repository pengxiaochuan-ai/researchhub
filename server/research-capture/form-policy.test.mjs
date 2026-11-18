import test from 'node:test';
import assert from 'node:assert/strict';
import {runtimeDependencies} from '../research-runtime/dependencies.mjs';
import {createResearchFormPolicy} from './form-policy.mjs';

const {load}=runtimeDependencies();
const legacy=Object.fromEntries(['normalizeFormSchema','normalizeAndValidateAnswers','scoreFormResponse','scorePublishedFormResponse'].map(key=>[key,load('study-operations/study-forms-policy',key)]));
const policy=createResearchFormPolicy(legacy);
const presentation={title:'合成问卷',recallPeriodPrompt:'过去两周',instruction:'请选择一项',attribution:'合成说明'};
const field={key:'answer',label:'合成条目',type:'integer',required:true,min:0,max:3,choices:[{value:0,label:'从未'},{value:1,label:'数天'},{value:2,label:'过半'},{value:3,label:'每天'}]};
const schema={schemaVersion:'form-schema.v1',presentation,fields:[field]};

test('versioned presentation and numeric choice labels survive schema normalization',()=>{
 assert.deepEqual(policy.normalizeFormSchema(schema),schema);
 assert.deepEqual(policy.normalizeFormSchema({fields:[{key:'old',label:'旧表单',type:'number'}]}),legacy.normalizeFormSchema({fields:[{key:'old',label:'旧表单',type:'number'}]}));
});
test('numeric choices preserve explicit zero and missing without converting strings',()=>{
 assert.deepEqual(policy.normalizeAndValidateAnswers(schema,{answer:0}),{answer:0});
 for(const value of [null,''])assert.deepEqual(policy.normalizeAndValidateAnswers(schema,{answer:value}),{answer:value});
 assert.deepEqual(policy.normalizeAndValidateAnswers(schema,{}),{});
 assert.throws(()=>policy.normalizeAndValidateAnswers(schema,{answer:'0'}),/FORM_ANSWER_INVALID_TYPE/);
});
test('all score entry points reject an in-range value absent from numeric choices',()=>{
 const sparse={fields:[{...field,choices:[{value:0,label:'无'},{value:3,label:'有'}]}]};
 for(const fn of [()=>policy.normalizeAndValidateAnswers(sparse,{answer:1}),()=>policy.scoreFormResponse(sparse,{answer:1}),()=>policy.scorePublishedFormResponse(sparse,{algorithm:'numeric-sum-v1'},{answer:1})])assert.throws(fn,/FORM_ANSWER_INVALID_OPTION/);
});
test('published numeric score stays compatible and missing scored answers never produce a complete total',()=>{
 assert.equal(policy.scorePublishedFormResponse(schema,{algorithm:'numeric-sum-v1'},{answer:0}).total,0);
 assert.equal(policy.scorePublishedFormResponse(schema,{algorithm:'numeric-sum-v1'},{answer:3}).total,3);
 const missing=policy.scorePublishedFormResponse(schema,{algorithm:'numeric-sum-v1'},{answer:null});assert.equal(missing.total,null);assert.equal(missing.complete,false);
 assert.equal(policy.scorePublishedFormResponse(schema,{algorithm:'unknown'},{answer:3}).algorithm,null);
});
test('invalid numeric choice definitions fail at normalization rather than being silently ignored',()=>{
 for(const choices of [[],[{value:'0',label:'零'}],[{value:0,label:''}],[{value:0,label:'零'},{value:0,label:'重复'}],[{value:4,label:'越界'}],[{value:1.5,label:'小数'}],[{value:Infinity,label:'无穷'}]])assert.throws(()=>policy.normalizeFormSchema({fields:[{...field,choices}]}),/FORM_SCHEMA_INVALID_CHOICES/);
 assert.throws(()=>policy.normalizeFormSchema({fields:[{key:'x',label:'文本',type:'text',choices:[{value:0,label:'零'}]}]}),/FORM_SCHEMA_INVALID_CHOICES/);
});
test('invalid presentation structures fail instead of losing source instructions',()=>{
 for(const p of [[],null,{title:3},{title:''},{html:'<b>unexpected</b>'}])assert.throws(()=>policy.normalizeFormSchema({...schema,presentation:p}),/FORM_SCHEMA_INVALID_PRESENTATION/);
});
