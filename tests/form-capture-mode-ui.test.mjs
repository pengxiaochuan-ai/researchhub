import test,{after}from'node:test';import assert from'node:assert/strict';import React from'react';import{renderToStaticMarkup}from'react-dom/server';import{createServer}from'vite';import*as session from'../src/questionnaire-h5-session.js';
const server=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true},appType:'custom',logLevel:'error'});after(()=>server.close());
const{CaptureModeField}=await server.ssrLoadModule('/pages/shared/CaptureFields.jsx');
const render=props=>renderToStaticMarkup(React.createElement(CaptureModeField,{name:'表5',config:{allowedCaptureModes:['researcher']},onChange:()=>{},...props}));
test('clinician-only fixed forms offer only research entry, with a short assessment note',()=>{
 assert.deepEqual(session.captureModeOptions({allowedCaptureModes:['researcher']}).map(x=>x.value),['researcher']);
 const html=render({form:{allowedCaptureModes:['researcher']}});assert.equal((html.match(/<option/g)||[]).length,1);assert(!html.includes('value="patient_h5"'));assert(html.includes('此表由研究人员评定'));
});
test('legacy forms with no channel metadata keep both existing single channels and mixed capture',()=>{
 assert.deepEqual(session.captureModeOptions({}).map(x=>x.value),['researcher','patient_h5','researcher,patient_h5']);
 assert.equal((render({form:{}}).match(/<option/g)||[]).length,3);
});
test('an incompatible old selection is visible and requires an explicit choice instead of silently switching',()=>{
 const html=render({form:{allowedCaptureModes:['researcher']},config:{allowedCaptureModes:['patient_h5']}});
 assert(html.includes('当前方式不可用，请重新选择'));assert.match(html,/<option value="patient_h5" disabled="" selected=""/);assert(html.includes('<option value="researcher"'));
});
test('explicit invalid channel metadata fails closed while patient-only profiles do not offer researcher capture',()=>{
 for(const modes of [null,[],['unknown'],['researcher','researcher']])assert.deepEqual(session.captureModeOptions({allowedCaptureModes:modes}),[]);
 assert.deepEqual(session.captureModeOptions({allowedCaptureModes:['patient_h5']}).map(x=>x.value),['patient_h5']);
});
