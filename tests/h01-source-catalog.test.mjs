import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'});after(()=>server.close());
async function render(props){const {default:HubSourceCatalog}=await server.ssrLoadModule('/pages/shared/HubSourceCatalog.jsx');return renderToStaticMarkup(React.createElement(HubSourceCatalog,props));}

test('source card renders real paper links and provenance in the original region, without confusing the record total with paper KPI',async()=>{
 const html=await render({sources:[{id:'pmc-PMC13550960',title:'A real source title',authors:'Researcher A',journal:'Journal',year:2026,sourceName:'PubMed Central',reviewVersion:'article:80'}],recordCount:13});
 assert(html.includes('real-hub-publications'));assert(html.includes('共 13 条来源记录'));
 assert(html.includes('href="/pages/e02/?recordId=pmc-PMC13550960"'));assert(html.includes('A real source title'));
 assert(html.includes('Researcher A · Journal · 2026'));assert(html.includes('PubMed Central'));
 assert(html.includes('非实时事件或已确认领域纳入'));assert(html.includes('href="/pages/e01/"'));
 assert(!html.includes('暂无已审核公开书目'));assert(!html.includes('13篇'));
});
test('approved scroll preview is keyboard focusable and retains all six complete source entries and links',async()=>{
 const sources=Array.from({length:6},(_,i)=>({id:'pmc-PMC'+(13522945+i),title:'Full long scientific title '+('complete wording '.repeat(12))+i,authors:'Author '+i,sourceName:'PubMed Central',reviewVersion:'article:'+i}));
 const html=await render({sources,recordCount:13});
 assert(html.includes('data-scroll-preview="true"'));
 assert(html.includes('tabindex="0"'));assert(html.includes('aria-label="获准论文来源预览"'));
 for(const item of sources){assert(html.includes(item.title));assert(html.includes('href="/pages/e02/?recordId='+item.id+'"'));}
 assert.equal((html.match(/<li>/g)??[]).length,6);
 for(const props of [{sources:null,recordCount:null,error:false},{sources:null,recordCount:null,error:true},{sources:[],recordCount:0}]){
  const state=await render(props);assert(!state.includes('tabindex="0"'));assert(!state.includes('data-scroll-preview="true"'));
 }
});
test('loading and failed source reads do not masquerade as a successful empty catalog',async()=>{
 const loading=await render({sources:null,recordCount:null,error:false});assert(loading.includes('正在读取来源目录'));assert(!loading.includes('暂无已审核公开书目'));
 const failed=await render({sources:null,recordCount:null,error:true});assert(failed.includes('来源目录暂不可用'));assert(!failed.includes('暂无已审核公开书目'));assert(!failed.includes('共 0 条'));
 const empty=await render({sources:[],recordCount:0,error:false});assert(empty.includes('共 0 条来源记录'));assert(empty.includes('暂无已审核公开书目'));
});

test('compact preview groups full bibliographic summary and retains full title for detail navigation',async()=>{
 const title='A complete long scientific title '.repeat(8).trim();
 const authors='Researcher A, Researcher B, Researcher C';
 const html=await render({sources:[{id:'pmc-PMC13550960',title,authors,journal:'Journal',year:2026,sourceName:'PubMed Central',reviewVersion:'article:80'}],recordCount:13});
 assert(html.includes('class="real-hub-source-summary"'));
 assert(html.includes('title="'+title+'"'));
 assert(html.includes(authors+' · Journal · 2026'));
 assert(html.includes('来源：PubMed Central · 审核版本 article:80'));
 assert(html.includes('href="/pages/e02/?recordId=pmc-PMC13550960"'));
 assert(!html.includes('abstract'));assert(!html.includes('摘要：'));
});
