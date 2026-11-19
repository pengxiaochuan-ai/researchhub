import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';

test('shared reading keeps workspace headings and supports a safe public document',async()=>{
 const vite=await createServer({server:{middlewareMode:true},appType:'custom'});
 try{
  const {AcademicReading}=await vite.ssrLoadModule('/pages/shared/AcademicReading.jsx');
  const item={id:'public-one',type:'news',title:'公开资料<script>示例</script>',body:'<script>不可执行</script>',summary:'正文说明',source:'现有公开资料',resources:[{label:'公开材料',key:'version_resource'}]};
  const legacy=renderToStaticMarkup(React.createElement(AcademicReading,{item}));
  const html=renderToStaticMarkup(React.createElement(AcademicReading,{item,headingLevel:1}));
  assert.match(legacy,/<h2>公开资料/);assert.match(legacy,/<h3>资料与回放/);
  assert.match(html,/<h1>公开资料/);assert.match(html,/<h2>资料与回放/);
  assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;不可执行/);
  assert.match(html,/href="\/api\/public\/hubs\/lingshu-xinyu\/academic-content\/public-one\/resources\/version_resource"/);
  assert.doesNotMatch(html,/\/api\/hubs\/lingshu-xinyu/);
 }finally{await vite.close();}
});
