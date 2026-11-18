import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {schemaFields,answerInput,fieldErrors,displayAnswer} from '../src/formal-capture-session.js';

const source=JSON.parse(readFileSync(new URL('../docs/planning/first-real-study-calibration-2026-11-13/core-forms/phq9-form-v1.json',import.meta.url)));
const schema=structuredClone(source.formSchema);
schema.presentation={title:source.content.title,recallPeriodPrompt:source.content.recallPeriodPrompt,instruction:source.content.instruction,attribution:source.content.permissionNotice};
schema.fields.slice(0,9).forEach((f,i)=>{f.label=(i+1)+'. '+source.content.scoredItems[i].text;f.choices=source.content.answerOptions.map(({value,label})=>({value,label}));});
const server=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true},appType:'custom',logLevel:'error'});
after(()=>server.close());
const components=await server.ssrLoadModule('/pages/shared/CaptureFields.jsx');
const render=(component,props)=>renderToStaticMarkup(React.createElement(component,props));

test('numeric answers display the fixed version labels while legacy schemas keep raw values',()=>{
 assert.equal(displayAnswer(2,schema.fields[0]),source.content.answerOptions[2].label);
 assert.equal(displayAnswer('difficulty_4',schema.fields[9]),source.content.functionalDifficulty.options[3].label);
 assert.equal(displayAnswer(0),'0');assert.equal(displayAnswer(false),'否');
 assert.equal(displayAnswer(null,schema.fields[0]),'缺失');assert.equal(displayAnswer(undefined,schema.fields[0]),'未填写');
 assert.equal(displayAnswer('2',schema.fields[0]),'2');
});
test('numeric choice values stay numbers and clearing restores missing rather than zero',()=>{
 const f=schema.fields[0];assert.deepEqual(answerInput({},f,'0'),{phq9_q1:0});
 assert.deepEqual(answerInput({phq9_q1:0},f,''),{});assert.equal(fieldErrors(schema.fields,{}).length,9);
 const sparse={key:'sparse',label:'离散值',type:'integer',choices:[{value:0,label:'零'},{value:2,label:'二'}]};
 assert.equal(fieldErrors([sparse],{sparse:1}).length,1);assert.deepEqual(fieldErrors([sparse],{sparse:0}),[]);
});
test('invalid numeric choices fail closed without changing the old select contract',()=>{
 assert(schemaFields(schema));
 for(const choices of [[{value:'0',label:'零'}],[{value:0,label:'零'},{value:0,label:'重复'}],[{value:1.5,label:'小数'}],[]]){
  assert.equal(schemaFields({fields:[{key:'x',label:'题目',type:'integer',choices}]}),null);
 }
 assert(schemaFields({fields:[{key:'x',label:'旧数值',type:'integer'}]}));
 assert.equal(schemaFields({fields:[{key:'x',label:'旧选择',type:'select',options:[{value:0,label:'零'}]}]}),null);
});
test('blank PHQ renders all source choices without a selected zero and retains function labels',()=>{
 const html=render(components.default,{fields:schema.fields,answers:{},onChange:()=>{}});
 assert.equal((html.match(/type="radio"/g)||[]).length,36);
 assert.equal((html.match(/checked=""/g)||[]).length,0);
 assert.equal((html.match(/type="number"/g)||[]).length,0);
 for(const {label} of source.content.answerOptions)assert.equal(html.split(label).length-1,9);
 assert(html.includes('极度困难'));assert(html.includes('完全沒有困难'));
 assert(html.includes('role="radiogroup"'));assert(html.includes('id="fc-field-0"'));
});
test('source presentation is plain escaped text and keeps original glyphs and line breaks',()=>{
 assert.equal(typeof components.FormPresentation,'function');
 const html=render(components.FormPresentation,{presentation:schema.presentation});
 for(const text of Object.values(schema.presentation))assert(html.includes(text));
 const untrusted=render(components.FormPresentation,{presentation:{title:'<img src=x>',instruction:{unsafe:true}}});
 assert(untrusted.includes('&lt;img src=x&gt;'));assert(!untrusted.includes('<img'));
});
test('submitted and historical answers resolve source labels from the supplied fixed fields',()=>{
 const html=render(components.ReadAnswers,{fields:schema.fields,answers:{phq9_q1:0,phq9_q2:3,functional_difficulty:'difficulty_4'}});
 assert(html.includes('<dd>从来沒有</dd>'));assert(html.includes('<dd>接近每天</dd>'));
 assert(html.includes('<dd>极度困难</dd>'));assert(!html.includes('<dd>difficulty_4</dd>'));
});
test('preview uses the same original choices, has unique input ids and starts unanswered',()=>{
 assert.equal(typeof components.FormPreview,'function');
 const html=renderToStaticMarkup(React.createElement('div',null,React.createElement(components.FormPreview,{schema}),React.createElement(components.FormPreview,{schema})));
 assert.equal((html.match(/type="radio"/g)||[]).length,72);
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
 assert(!html.includes('checked=""'));assert(html.includes(schema.presentation.recallPeriodPrompt));
});
test('read-only choice controls and validation are accessible with no enabled clear action',()=>{
 const html=render(components.default,{fields:schema.fields,answers:{},onChange:()=>{},disabled:true,errors:[{key:'phq9_q1',message:'请填写'}]});
 assert(html.includes('aria-describedby="fc-field-0-error"'));assert(html.includes('aria-invalid="true"'));
 assert.equal((html.match(/<fieldset[^>]*disabled=""/g)||[]).length,9);
 assert.equal((html.match(/<button[^>]*disabled=""/g)||[]).length,9);
});
test('a corrected numeric choice removes a stale required error while clearing exposes it again',()=>{
 const props={fields:[schema.fields[0]],onChange:()=>{},errors:[{key:'phq9_q1',message:'尚未填写'}]};
 assert(!render(components.default,{...props,answers:{phq9_q1:0}}).includes('role="alert"'));
 assert(render(components.default,{...props,answers:{}}).includes('role="alert"'));
});
