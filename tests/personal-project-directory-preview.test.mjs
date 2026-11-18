import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'});after(()=>server.close());
const data={profile:{displayName:'本人',tenantName:'租户'},summary:{projectCount:999,ownDraftCount:1,myOpenTaskCount:1},studyGroups:[{id:'legacy-group',name:'不应使用的旧组',projects:[{id:'legacy-project',name:'不应使用的旧课题'}]}],drafts:[{id:'plan-one',studyGroupId:'g1',researchProjectId:'p1',title:'原方案草稿保持',version:1,updatedAt:'2026-11-11T01:00:00Z',workspace:{kind:'plan'}}],tasks:[{id:'task-one',studyGroupId:'g1',researchProjectId:'p1',title:'原任务保持',status:'open',dueAt:null}],activity:[]};
const items=Array.from({length:7},(_,i)=>({key:'directory-'+i,title:'同源课题预览 '+i,summary:'问题 '+i,status:'draft',updatedAt:'2026-11-11T01:00:00Z',...(i===0?{studyGroupName:'真实研究组'}:{}),links:{primary:'/pages/q01/?researchCreation=1&projectIntentId=intent-'+i}}));
const directory={kind:'ready',items,total:7,nextCursor:null,capabilities:{canCreateProject:true},message:''};
async function render(props={}){const {default:View}=await server.ssrLoadModule('/pages/shared/PersonalOverview.jsx');return renderToStaticMarkup(React.createElement(View,{data,projectDirectory:directory,...props}));}
test('P01 renders at most five same-directory rows with exact supplied links and one footer',async()=>{
 const html=await render();for(let i=0;i<5;i++){assert(html.includes('同源课题预览 '+i));assert(html.includes('href="/pages/q01/?researchCreation=1&amp;projectIntentId=intent-'+i+'"'));}for(let i=5;i<7;i++)assert(!html.includes('同源课题预览 '+i));
 assert(!html.includes('不应使用的旧'));assert(!html.includes('999'));assert.match(html,/真实研究组/);assert.match(html,/课题草稿/);
 assert.equal((html.match(/查看更多课题 →/g)||[]).length,1);assert.match(html,/href="\/pages\/q02\/\?researchProjects=1"[^>]*>查看更多课题 →/);
 assert(!html.includes('personal-project-actions'));assert(!html.includes('>新建课题<'));assert(!html.includes('>全部课题<'));
 assert(html.indexOf('查看更多课题 →')>html.indexOf('同源课题预览 4'));assert(html.indexOf('查看更多课题 →')<html.indexOf('personal-draft-details'));assert.match(html,/当前可查看课题与草稿/);
 assert.equal((html.match(/7 项/g)||[]).length,3);
});
test('ready zero is an explicit empty state and direct creation follows the capability',async()=>{
 const empty={...directory,items:[],total:0};let html=await render({projectDirectory:empty});assert.match(html,/尚无可查看的课题与草稿/);assert.match(html,/href="\/pages\/q01\/\?researchCreation=1"[^>]*>新建课题/);
 html=await render({projectDirectory:{...empty,capabilities:{canCreateProject:false}}});assert(!html.includes('>新建课题<'));assert(html.includes('查看更多课题 →'));
});
test('loading, errors and restrictions never borrow old counts or pretend an empty directory',async()=>{
 const {default:View}=await server.ssrLoadModule('/pages/shared/PersonalOverview.jsx');const pending=renderToStaticMarkup(React.createElement(View,{data}));assert.match(pending,/正在读取课题/);assert(!pending.includes('999'));assert(!pending.includes('尚无可查看的课题与草稿'));
 const failed=await render({projectDirectory:{...directory,kind:'error',message:'课题读取失败'}});assert.match(failed,/role="alert"/);assert.match(failed,/课题读取失败/);assert.match(failed,/>重新读取课题</);assert(!failed.includes('同源课题预览'));assert(!failed.includes('尚无可查看的课题与草稿'));
 const restricted=await render({projectDirectory:{...directory,kind:'restricted',message:'当前账号无权查看课题'}});assert.match(restricted,/当前账号无权查看课题/);assert(!restricted.includes('同源课题预览'));assert(!restricted.includes('researchProjects=1'));
});
test('unverified identity hides directory content, count and all its navigation',async()=>{
 const html=await render({unverified:true});assert(!html.includes('同源课题预览'));assert(!html.includes('真实研究组'));assert(!html.includes('researchProjects=1'));assert(!html.includes('researchCreation=1'));assert(!html.includes('7 项'));assert.match(html,/身份与课题授权尚未核验/);
});
test('existing task and own research draft disclosures retain their exact destinations',async()=>{
 const html=await render();assert.match(html,/原任务保持/);assert.match(html,/待我处理 · 1 项任务/);assert.match(html,/href="\/pages\/s08\/\?studyGroupId=g1&amp;researchProjectId=p1&amp;taskId=task-one"/);
 assert.match(html,/原方案草稿保持/);assert.match(html,/本人研究草稿 · 1 份/);assert.match(html,/href="\/pages\/q01\/\?researchPlanId=plan-one&amp;studyGroupId=g1&amp;researchProjectId=p1"/);
});
