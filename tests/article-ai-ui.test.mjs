import test,{after} from 'node:test';import assert from 'node:assert/strict';
import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {createServer} from 'vite';
import {readFileSync} from 'node:fs';
const server=await createServer({configFile:false,esbuild:{jsx:'automatic'},optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'});after(()=>server.close());
test('article branch preserves three original regions and shows fixed article/preview within existing context rail',async()=>{
  const {ArticleWorkspace}=await server.ssrLoadModule('/pages/shared/ArticleAgentPanel.jsx');
  const binding={recordId:'pmc-PMC99001001',articleVersion:'PMC99001001.1',rawSha256:'a'.repeat(64),reviewVersion:'article:1'};
  const article={binding,title:'Long synthetic article title',coverage:{notice:'基于本次选取的原文片段，非全文逐字审阅'},execution:{canStart:false,message:'单篇AI未获付费批准'},omissions:['image-pixels'],evidence:{fragments:[{id:'fragment-1',field:'body',offset:0,length:15,text:'Synthetic body.',textHash:'b'.repeat(64),locator:{kind:'field-offset'}}]}};
  const html=renderToStaticMarkup(React.createElement(ArticleWorkspace,{view:{kind:'ready',article,question:'核对本篇',phase:'idle'},actions:{},contextRail:React.createElement('aside',{className:'contextRail'},'原上下文'),user:{displayName:'合成科研人员'}}));
  for(const c of ['conversationList','chat','composer','contextRail'])assert(html.includes(c),c);
  assert(html.includes('Synthetic body.'));assert(html.includes('PMC99001001.1'));assert(html.includes('article-evidence-body'));
  assert(!html.includes('中心 03'));assert(!html.includes('已生成'));
});
test('article evidence rail is absent while loading, restricted, failed to load or revalidating identity',async()=>{
 const {ArticleWorkspace}=await server.ssrLoadModule('/pages/shared/ArticleAgentPanel.jsx');
 const article={binding:{recordId:'pmc-PMC99001001',articleVersion:'PMC99001001.1',rawSha256:'a'.repeat(64),reviewVersion:'article:1'},title:'OLD PRIVATE ARTICLE',coverage:{notice:'本次选段'},execution:{canStart:false},evidence:{fragments:[{id:'f1',field:'body',offset:0,length:12,text:'OLD EVIDENCE'}]}};
 for(const view of [{kind:'loading'},{kind:'error'},{kind:'restricted'},{kind:'ready',paused:true},{kind:'ready',article:{...article,status:'restricted'}}]){
  const html=renderToStaticMarkup(React.createElement(ArticleWorkspace,{view:{phase:'idle',article,...view}}));
  assert.doesNotMatch(html,/contextRail|OLD EVIDENCE/);
 }
});
test('evidence text positioning preserves original whitespace and never inserts source HTML',async()=>{
  const {ArticleFieldText}=await server.ssrLoadModule('/pages/e02/src/RealEvidenceDetail.jsx');
  const html=renderToStaticMarkup(React.createElement(ArticleFieldText,{text:'  Synthetic\n  body. <script>bad()</script>',field:'body',location:{field:'body',offset:0,length:15}}));
  assert.match(html,/<mark[^>]*>Synthetic\n  body\.<\/mark>/);assert(!html.includes('<script>'));assert(html.includes('&lt;script&gt;'));
});
test('query explanation stays in original feedback with applied terms and no semantic equivalence claim',async()=>{
  const {QueryPlanHint}=await server.ssrLoadModule('/pages/e01/src/RealEvidence.jsx');
  const html=renderToStaticMarkup(React.createElement(QueryPlanHint,{plan:{mode:'mapped',dictionaryVersion:'v1',appliedTerms:['针灸','acupuncture'],warning:null}}));
  assert(html.includes('已按中英文关键词检索'));assert(html.includes('acupuncture'));assert(html.includes('不是医学等价关系'));
});
test('real article response uses existing safe Markdown reader rather than raw markers or model network links',async()=>{
 const {ArticleWorkspace}=await server.ssrLoadModule('/pages/shared/ArticleAgentPanel.jsx');const binding={recordId:'pmc-PMC99001001',articleVersion:'PMC99001001.1',rawSha256:'a'.repeat(64),reviewVersion:'article:1'};
 const article={binding,title:'Synthetic',coverage:{notice:'本次选段'},execution:{canStart:false},evidence:{fragments:[]}};
 const html=renderToStaticMarkup(React.createElement(ArticleWorkspace,{view:{kind:'ready',article,phase:'completed',answer:{content:'# 结论\n\n**仅合成说明** [恶意链接](https://untrusted.invalid)\n\n![模型图](https://untrusted.invalid/x.png)'}}}));assert(html.includes('<h3'));assert(html.includes('<strong'));assert(!html.includes('href="https://untrusted.invalid'));assert(!html.includes('<img'));assert(!html.includes('# 结论'));
});

test('historical answer context shows its sealed evidence, never latest-strategy preview as its original input',async()=>{
  const {ArticleWorkspace}=await server.ssrLoadModule('/pages/shared/ArticleAgentPanel.jsx');
  const binding={recordId:'pmc-PMC99001001',articleVersion:'PMC99001001.1',rawSha256:'a'.repeat(64),reviewVersion:'article:1'};
  const fresh={binding,title:'Synthetic',coverage:{notice:'new preview'},execution:{canStart:false},evidence:{fragments:[{id:'fragment-1',text:'NEW STRATEGY PREVIEW',field:'body',offset:0,length:20}]}};
  const old={binding,source:{title:'Synthetic'},coverage:{notice:'Original fixed input'},omissions:[],fragments:[{id:'fragment-1',field:'body',text:'ORIGINAL SEALED EVIDENCE',offset:0,length:24}]};
  const html=renderToStaticMarkup(React.createElement(ArticleWorkspace,{view:{kind:'ready',article:fresh,phase:'completed',answer:{content:'原回答。[1]',meta:{sourceStatus:'current',provenance:{articleEvidence:old}}}}}));
  assert(html.includes('ORIGINAL SEALED EVIDENCE'));assert(!html.includes('NEW STRATEGY PREVIEW'));
});

test('article question starts with two rows without native truncation, keeping label, explicit submit and disabled identity state',async()=>{
 const {ArticleWorkspace}=await server.ssrLoadModule('/pages/shared/ArticleAgentPanel.jsx');
 const html=renderToStaticMarkup(React.createElement(ArticleWorkspace,{view:{kind:'loading',phase:'idle',question:'第一行\n第二行'}}));
 assert.match(html,/<textarea[^>]*rows="2"/);assert.doesNotMatch(html,/<textarea[^>]*maxLength=/i);assert.match(html,/<textarea[^>]*disabled/);assert(html.includes('第一行\n第二行'));assert(html.includes('本篇研究问题'));assert.match(html,/<button[^>]*type="submit"/);
});

test('article question grows, caps with internal scrolling, shrinks, and respects viewport height',async()=>{
 const {fitArticleQuestion}=await server.ssrLoadModule('/pages/shared/ArticleAgentPanel.jsx');
 const style={minHeight:'60px',maxHeight:'148px',borderTopWidth:'0px',borderBottomWidth:'0px'};
 const el={style:{},scrollHeight:60};
 fitArticleQuestion(el,style,900);assert.equal(el.style.height,'60px');assert.equal(el.style.overflowY,'hidden');
 el.scrollHeight=104;fitArticleQuestion(el,style,900);assert.equal(el.style.height,'104px');
 el.scrollHeight=280;fitArticleQuestion(el,style,900);assert.equal(el.style.height,'148px');assert.equal(el.style.overflowY,'auto');
 fitArticleQuestion(el,style,500);assert.equal(el.style.height,'100px');
 fitArticleQuestion(el,style,200);assert.equal(el.style.height,'60px');
 el.scrollHeight=38;fitArticleQuestion(el,style,900);assert.equal(el.style.height,'60px');assert.equal(el.style.overflowY,'hidden');
});

test('article question accounts for borders without clipping content at its cap',async()=>{
 const {fitArticleQuestion}=await server.ssrLoadModule('/pages/shared/ArticleAgentPanel.jsx');
 const el={style:{},scrollHeight:102};fitArticleQuestion(el,{minHeight:'60px',maxHeight:'148px',borderTopWidth:'1px',borderBottomWidth:'1px'},900);
 assert.equal(el.style.height,'104px');assert.equal(el.style.overflowY,'hidden');
});

test('compact input styles stay in the article workspace and retain normal input typography',()=>{
 const css=readFileSync('pages/shared/real-ai-workspace.css','utf8');
 assert.match(css,/\.real-ai-workspace \.article-workspace \.composer textarea\s*\{[^}]*min-height:60px/);
 assert.match(css,/\.real-ai-workspace \.article-workspace \.composer textarea\s*\{[^}]*resize:none/);
 assert.match(css,/\.real-ai-workspace \.article-workspace \.article-composer-footer\s*\{/);
});
test('generic workbench uses the same two-row auto-sized composer as article mode',async()=>{
 const {default:HubAgentPanel}=await server.ssrLoadModule('/pages/shared/HubAgentPanel.jsx');
 const html=renderToStaticMarkup(React.createElement(HubAgentPanel,{layout:'workbench',user:{}}));
 assert.match(html,/<textarea[^>]*rows="2"/);assert(html.includes('agent-question'));
 const css=readFileSync('pages/shared/real-ai-workspace.css','utf8');assert.match(css,/\.real-ai-workspace \.composer textarea\s*\{[^}]*resize:none/);
});
test('restored failed question shows nontechnical failure status without automatic replay',async()=>{
 const {default:AgentMessages}=await server.ssrLoadModule('/pages/shared/AgentMessages.jsx');
 const html=renderToStaticMarkup(React.createElement(AgentMessages,{messages:[{id:'u1',role:'user',content:'保留问题'}],jobs:[{id:'j',userMessageId:'u1',status:'failed',errorMessage:'INTERNAL_STACK'}]}));
 assert(html.includes('本次未交付回答'));assert(!html.includes('INTERNAL_STACK'));assert(html.includes('保留问题'));
});
