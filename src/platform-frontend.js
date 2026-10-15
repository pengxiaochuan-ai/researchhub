import pageManifest from '../platform-pages.json';
import {goToPage} from './platform-navigation.js';
import {browserDemoStore} from './demo-research-store.js';
import {readContext} from './route-context.js';
import './platform-frontend.css';

let activeDialog;
function dialog(title){
  activeDialog?.close();activeDialog?.remove();
  const node=document.createElement('dialog');node.className='qiyan-demo-dialog';node.setAttribute('aria-labelledby','qiyan-demo-title');
  const close=document.createElement('button');close.type='button';close.className='qiyan-demo-close';close.textContent='关闭';close.addEventListener('click',()=>node.close());
  const heading=document.createElement('h2');heading.id='qiyan-demo-title';heading.textContent=title;node.append(close,heading);
  node.addEventListener('close',()=>node.remove());document.body.append(node);activeDialog=node;return node;
}
function text(node,value){const p=document.createElement('p');p.textContent=value;node.append(p);return p;}
function action(node,label,callback){const button=document.createElement('button');button.type='button';button.textContent=label;button.addEventListener('click',callback);node.append(button);return button;}
function showMessage(title,value){const node=dialog(title);text(node,value);node.showModal();}
function localSearch(){const node=dialog('搜索本机演示与页面');text(node,'搜索当前浏览器的课题与资产及已接入页面；不是后端全文检索。');const input=document.createElement('input');input.type='search';input.placeholder='输入名称或页面关键词';input.setAttribute('aria-label','搜索本机演示与页面');const results=document.createElement('div');results.className='qiyan-demo-results';node.append(input,results);function render(){results.replaceChildren();let store;try{store=browserDemoStore();}catch(err){text(results,err.message);return;}const items=[...store.list('projects').map(item=>({title:item.name,page:'s01',context:{projectId:item.id,protocolId:null,assetId:null,subjectId:null,outputId:null,view:null}})),...store.list('assets').map(item=>({title:item.title,page:'a02',context:{assetId:item.id,projectId:item.projectId||null,protocolId:null,subjectId:null,outputId:null,view:null}})),...pageManifest.pages.map(item=>({title:item.title,page:item.id,context:{projectId:null,protocolId:null,assetId:null}}))].filter(item=>item.title.includes(input.value.trim()));items.slice(0,25).forEach(item=>action(results,item.title,()=>goToPage(item.page,item.context)));if(!items.length)text(results,'未找到匹配项。');}input.addEventListener('input',render);render();node.showModal();input.focus();}
function notifications(){const node=dialog('本机操作与提醒');text(node,'这里显示本机操作记录，不代表已接入消息发送或通知服务。');try{const records=browserDemoStore().list('events').slice(0,12);if(!records.length)text(node,'暂无本机操作记录。');records.forEach(item=>text(node,item.title+' · '+item.at));action(node,'打开演示任务',()=>goToPage('q02',{projectId:null,protocolId:null}));}catch(err){text(node,err.message);}node.showModal();}
function userMenu(){const node=dialog('演示身份与账号');text(node,'当前是前端演示用户，没有通过真实认证；本机成员角色不授予服务端权限。');action(node,'完善本机学术资料',()=>goToPage('p006',{returnTo:location.pathname+location.search}));action(node,'查看账号登录页面',()=>goToPage('p003',{returnTo:location.pathname+location.search}));action(node,'退出前端演示',()=>{try{sessionStorage.removeItem('lingshu-demo-mode');}catch{}goToPage('p003',{projectId:null,protocolId:null});});node.showModal();}
function assetFromFixture(){const store=browserDemoStore();const existing=store.list('assets').find(item=>item.reference==='AS-2026-018');if(existing)return existing;return store.saveAsset({title:'针灸治疗抑郁症研究方案模板（历史示例副本）',content:'这是原A02固定示例的本机副本，仅用于复用流程演示。正式方案内容需另行核对，不作为真实研究方案。',reference:'AS-2026-018',scope:'本机演示'});}
function handlePageAction(event){const {pageId,label}=event.detail||{};if(pageId==='q01')return;
  if(label==='上传资产'){goToPage('a01',{view:'local',assetId:null,projectId:null});return;}
  if(pageId==='a02'&&['复用此资产','引用','下载','分享'].includes(label)){
    if(label==='复用此资产'){try{const context=readContext(location.search);const asset=context.assetId?browserDemoStore().get('assets',context.assetId):assetFromFixture();goToPage('a02',{assetId:asset.id,projectId:null});}catch(err){showMessage('本机复用不可打开',err.message);}return;}
    showMessage(label,'当前未接入真实文件、引用、共享或权限服务。可以使用“复用此资产”体验有来源记录的本机演示。');return;
  }
  if(pageId==='ai01'){showMessage(label,'当前没有模型服务。已有AI回答是固定示例，不会自动生成研究结果。你可以在明确对象上下文后录入演示内容。');return;}
  showMessage(label||'操作说明','这项操作尚未连接正式服务。本机演示可从“我的课题”继续：保存课题、编辑方案、记录任务与产出，再复用资产。');
}
function contextAction(event){const {pageId,label}=event.detail||{};const targets={'指南与教材':'h06','相关研究':'h07','科研产出':'s10','团队与设置':'s11','数据治理':'g05','研究质量':'s05','用户与权限':'g03','多中心管理':'s11','审计日志':'g04','系统配置':'g05','研究设计':'s07','写作助手':'s10'};if(targets[label]){goToPage(targets[label]);return;}if(label==='对话')showMessage('AI对话','当前展示固定AI示例，真实模型未接入。');else showMessage(label||'页面说明','当前标签为本页状态或尚待正式服务接入。');}
window.addEventListener('qiyan:help',()=>goToPage('p008'));
window.addEventListener('qiyan:search-open',localSearch);
window.addEventListener('qiyan:notifications-open',notifications);
window.addEventListener('qiyan:user-menu-open',userMenu);
window.addEventListener('qiyan:page-action',handlePageAction);
window.addEventListener('qiyan:context-nav',contextAction);
window.addEventListener('qiyan:collapse',()=>{document.body.classList.toggle('qiyan-sidebar-collapsed');});
export function mountFrontendLinks(){
  const workflow=document.querySelector('.wf-content'),aside=document.querySelector('.qiyan-platform-sidebar');
  if(workflow&&aside&&!document.querySelector('.qiyan-workflow-nav-toggle')){
    aside.id='qiyan-workspace-nav';
    const mobile=matchMedia('(max-width:700px)'),toggle=document.createElement('button');
    toggle.type='button';toggle.className='qiyan-workflow-nav-toggle';toggle.textContent='工作区导航';toggle.setAttribute('aria-controls',aside.id);
    const sync=()=>{const open=mobile.matches&&document.body.classList.contains('qiyan-mobile-menu-open');toggle.setAttribute('aria-expanded',String(open));aside.inert=mobile.matches&&!open;};
    toggle.addEventListener('click',()=>{document.body.classList.toggle('qiyan-mobile-menu-open');sync();});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'){document.body.classList.remove('qiyan-mobile-menu-open');sync();}});
    mobile.addEventListener('change',sync);document.body.append(toggle);sync();
  }
  const sidebar=document.querySelector('.qiyan-sidebar-tools');
  if(sidebar&&!sidebar.querySelector('[data-local-projects]'))action(sidebar,'我的课题与草稿',()=>goToPage('q02',{projectId:null,protocolId:null,assetId:null})).setAttribute('data-local-projects','true');
  const main=document.querySelector('main');
  if(main&&!main.querySelector('[data-demo-capability]')){const note=document.createElement('div');note.dataset.demoCapability='true';note.className='qiyan-demo-capability';note.textContent='前端演示 · 固定示例与本机草稿分开。真实认证、协作、AI与统计服务尚未接入。';action(note,'打开本机课题',()=>goToPage('q02',{projectId:null,protocolId:null,assetId:null}));action(note,'本机科研资产',()=>goToPage('a01',{view:'local',projectId:null,protocolId:null,assetId:null}));main.querySelector('.qiyan-page-context')?.after(note);if(!note.isConnected)main.prepend(note);}
}
