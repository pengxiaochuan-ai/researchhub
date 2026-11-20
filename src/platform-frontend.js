import pageManifest from '../platform-pages.json';
import {goToPage} from './platform-navigation.js';
import {browserDemoStore} from './demo-research-store.js';
import {readContext} from './route-context.js';
import {isAssetDraftRoute} from './synthetic-asset-route.js';
import {getPlatformUser,platformAuth,realIdentityMode} from './platform-user.js';
import {isResearchDesignRoute} from './research-design-session.js';
import {isPreparationRoute} from './research-execution-preparation-session.js';
import {isSyntheticEdcRoute} from './synthetic-edc-session.js';
import {isCrfMethodsRoute} from './crf-methods-session.js';
import {isCrfMethodAssetsRoute,makeCrfMethodAssetUrl} from './crf-method-assets-session.js';
import {isAssetApplicabilityRoute} from './asset-applicability-session.js';
import {catalogOwnsPageAction} from './research-assets-catalog-session.js';
import {realModeRouteState} from './real-mode-route.js';
import {showWorkspaceNotice} from './workspace-notice.js';
import './platform-frontend.css';

let activeDialog;
let hubNavigationSync;
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
function localSearch(){const node=dialog('搜索本机演示与页面');text(node,"搜索此浏览器保存的演示课题、资产及页面。");const input=document.createElement('input');input.type='search';input.placeholder='输入名称或页面关键词';input.setAttribute('aria-label','搜索本机演示与页面');const results=document.createElement('div');results.className='qiyan-demo-results';node.append(input,results);function render(){results.replaceChildren();let store;try{store=browserDemoStore();}catch(err){text(results,err.message);return;}const items=[...store.list('projects').map(item=>({title:item.name,page:'s01',context:{projectId:item.id,protocolId:null,assetId:null,subjectId:null,outputId:null,view:null}})),...store.list('assets').map(item=>({title:item.title,page:'a02',context:{assetId:item.id,projectId:item.projectId||null,protocolId:null,subjectId:null,outputId:null,view:null}})),...pageManifest.pages.map(item=>({title:item.title,page:item.id,context:{projectId:null,protocolId:null,assetId:null}}))].filter(item=>item.title.includes(input.value.trim()));items.slice(0,25).forEach(item=>action(results,item.title,()=>goToPage(item.page,item.context)));if(!items.length)text(results,'未找到匹配项。');}input.addEventListener('input',render);render();node.showModal();input.focus();}
function notifications(){const node=dialog('本机操作与提醒');text(node,"此处显示浏览器内的演示操作记录，不发送通知。");try{const records=browserDemoStore().list('events').slice(0,12);if(!records.length)text(node,'暂无本机操作记录。');records.forEach(item=>text(node,item.title+' · '+item.at));action(node,'打开演示任务',()=>goToPage('q02',{projectId:null,protocolId:null}));}catch(err){text(node,err.message);}node.showModal();}
function userMenu(){
 if(realIdentityMode){const user=getPlatformUser(),node=dialog('当前真实账号');text(node,user.displayName+' · '+user.roleName);const status=text(node,'操作权限以当前研究授权为准。');status.setAttribute('role','status');
  action(node,'本人资料',()=>location.assign('/pages/p006/'));action(node,'登录或切换账号',()=>location.assign('/pages/p003/'));action(node,'检查登录状态',async()=>{await platformAuth.refresh();const next=getPlatformUser();status.textContent=next.displayName+' · '+next.roleName;});
  if(user.authenticated)action(node,'退出当前浏览器会话',async event=>{event.currentTarget.disabled=true;try{await platformAuth.logout();window.dispatchEvent(new Event('qiyan:auth-changed'));status.textContent='已退出当前浏览器会话，不代表撤销其他设备。';}catch(e){status.textContent=e.message;event.currentTarget.disabled=false;}});
  node.showModal();return;
 }
 const node=dialog('演示身份与账号');text(node,"当前为演示身份，不具有真实研究或管理权限。");action(node,'完善本机学术资料',()=>goToPage('p006',{returnTo:location.pathname+location.search}));action(node,'查看账号登录页面',()=>goToPage('p003',{returnTo:location.pathname+location.search}));action(node,"退出演示模式",()=>{try{sessionStorage.removeItem('lingshu-demo-mode');}catch{}goToPage('p003',{projectId:null,protocolId:null});});node.showModal();}
function assetFromFixture(){const store=browserDemoStore();const existing=store.list('assets').find(item=>item.reference==='AS-2026-018');if(existing)return existing;return store.saveAsset({title:'针灸治疗抑郁症研究方案模板（历史示例副本）',content:'这是原A02固定示例的本机副本，仅用于复用流程演示。正式方案内容需另行核对，不作为真实研究方案。',reference:'AS-2026-018',scope:'本机演示'});}
function handlePageAction(event){const {pageId,label}=event.detail||{};if(pageId==='q01')return;
  if(event.detail?.blockedReason){showMessage(label,event.detail.blockedReason);return;}
  if(realIdentityMode&&pageId==='ai01'&&document.querySelector('.real-ai-workspace'))return;
  if(catalogOwnsPageAction({real:realIdentityMode,pageId,search:location.search,label}))return;
  if(isAssetApplicabilityRoute(pageId,location.search))return;
  if(isCrfMethodAssetsRoute(pageId,location.search))return;
  if(pageId==='a01'&&label==='我的资产候选'){location.assign('/pages/a01/?assetDrafts=1');return;}
  if(isAssetDraftRoute(pageId,location.search))return;
  if(label==='上传资产'){goToPage('a01',{view:'local',assetId:null,projectId:null});return;}
  if(pageId==='a02'&&['复用此资产','引用','下载','分享'].includes(label)){
    if(label==='复用此资产'){try{const context=readContext(location.search);const asset=context.assetId?browserDemoStore().get('assets',context.assetId):assetFromFixture();goToPage('a02',{assetId:asset.id,projectId:null});}catch(err){showMessage('本机复用不可打开',err.message);}return;}
    showMessage(label,"此操作暂不可用。可选择“复用此资产”体验演示流程。");return;
  }
  if(pageId==='ai01'){showMessage(label,"当前为固定AI示例，未调用模型，不能作为研究结论。");return;}
  showMessage(label||'操作说明',"此操作暂不可用。可从“我的课题”继续演示流程。");
}
function contextAction(event){const {pageId,label}=event.detail||{};
 if(realIdentityMode&&pageId==='ai01'){
  if(label==='对话'){document.querySelector('.real-ai-workspace textarea')?.focus();return;}
  if(label==='研究设计'){location.assign('/pages/q02/');return;}
  showMessage(label||'能力说明',"此能力在当前研究中暂不可用。");return;
 }
 const targets={'指南与教材':'h06','相关研究':'h07','科研产出':'s10','团队与设置':'s11','数据治理':'g05','研究质量':'s05','用户与权限':'g03','多中心管理':'s11','审计日志':'g04','系统配置':'g05','研究设计':'s07','写作助手':'s10'};if(targets[label]){goToPage(targets[label]);return;}if(label==='对话')showMessage('AI对话',"当前为固定AI示例，未调用模型。");else showMessage(label||'页面说明',"此项功能暂不可用。");}
window.addEventListener('qiyan:help',()=>goToPage('p008'));
window.addEventListener('qiyan:search-open',()=>realIdentityMode?showMessage("全局搜索暂不可用","请进入知识资料检索你有权访问的内容。"):localSearch());
window.addEventListener('qiyan:notifications-open',()=>realIdentityMode?showMessage("通知暂不可用","请到“我的工作台”查看你的待办。"):notifications());
window.addEventListener('qiyan:user-menu-open',userMenu);
window.addEventListener('qiyan:page-action',handlePageAction);
window.addEventListener('qiyan:context-nav',contextAction);
window.addEventListener('qiyan:collapse',()=>{document.body.classList.toggle('qiyan-sidebar-collapsed');});
export function mountFrontendLinks(){
  const pageId=location.pathname.match(/^\/pages\/([^/]+)/)?.[1];
  const workflow=document.querySelector('.wf-content'),aside=document.querySelector('.qiyan-platform-sidebar');
  if(workflow&&aside&&!(pageId==='g04'&&document.body.dataset.hubSourceReal==='true')&&!document.querySelector('.qiyan-workflow-nav-toggle')){
    aside.id='qiyan-workspace-nav';
    const mobile=matchMedia('(max-width:700px)'),toggle=document.createElement('button');
    toggle.type='button';toggle.className='qiyan-workflow-nav-toggle';toggle.textContent='工作区导航';toggle.setAttribute('aria-controls',aside.id);
    const sync=()=>{const open=mobile.matches&&document.body.classList.contains('qiyan-mobile-menu-open');toggle.setAttribute('aria-expanded',String(open));aside.inert=mobile.matches&&!open;};
    toggle.addEventListener('click',()=>{document.body.classList.toggle('qiyan-mobile-menu-open');sync();});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'){document.body.classList.remove('qiyan-mobile-menu-open');sync();}});
    mobile.addEventListener('change',sync);document.body.append(toggle);sync();
  }
  if(['h01','h05','c01','c03','h06','t01','t02','r01','r02','g03','g04','g01'].includes(pageId)&&document.body.dataset.hubSourceReal==='true'&&aside&&!document.querySelector('.qiyan-hub-nav-toggle')){
    aside.id='qiyan-hub-primary-nav';
    const mobile=matchMedia('(max-width:900px)'),toggle=document.createElement('button'),backdrop=document.createElement('button');
    toggle.type='button';toggle.className='qiyan-hub-nav-toggle';toggle.setAttribute('aria-controls',aside.id);
    backdrop.type='button';backdrop.className='qiyan-hub-nav-backdrop';backdrop.setAttribute('aria-label','关闭平台导航');
    backdrop.tabIndex=-1;
    const sync=()=>{
      if(!mobile.matches)document.body.classList.remove('qiyan-hub-mobile-menu-open');
      const open=mobile.matches&&document.body.classList.contains('qiyan-hub-mobile-menu-open');
      toggle.textContent=open?'关闭平台导航':'平台导航';toggle.setAttribute('aria-expanded',String(open));
      const currentAside=document.querySelector('.qiyan-platform-sidebar');
      if(currentAside){currentAside.id='qiyan-hub-primary-nav';currentAside.inert=mobile.matches&&!open;
        if(open){currentAside.setAttribute('role','dialog');currentAside.setAttribute('aria-modal','true');currentAside.setAttribute('aria-label','平台导航');}
        else{currentAside.removeAttribute('role');currentAside.removeAttribute('aria-modal');currentAside.removeAttribute('aria-label');}}
      for(const background of [document.querySelector('header.global-platform-header'),document.querySelector('.platform-main')]){
        if(background)background.inert=open;
      }
      backdrop.hidden=!open;
    };
    const close=()=>{document.body.classList.remove('qiyan-hub-mobile-menu-open');sync();toggle.focus();};
    toggle.addEventListener('click',()=>{
      if(document.body.classList.contains('qiyan-hub-mobile-menu-open')){close();return;}
      document.body.classList.add('qiyan-hub-mobile-menu-open');sync();
      document.querySelector('.qiyan-platform-sidebar .qiyan-nav-item')?.focus();
    });
    backdrop.addEventListener('click',close);
    document.addEventListener('keydown',event=>{
      if(!document.body.classList.contains('qiyan-hub-mobile-menu-open'))return;
      if(event.key==='Escape'){event.preventDefault();close();return;}
      if(event.key!=='Tab')return;
      const currentAside=document.querySelector('.qiyan-platform-sidebar');
      const items=[...(currentAside?.querySelectorAll('button:not([disabled])')??[]),toggle]
        .filter(item=>item.getClientRects().length>0);
      if(!items.length)return;
      const index=items.indexOf(document.activeElement);
      const next=event.shiftKey?(index<=0?items.length-1:index-1):(index<0||index===items.length-1?0:index+1);
      event.preventDefault();items[next].focus();
    });
    hubNavigationSync=sync;mobile.addEventListener('change',sync);document.body.append(toggle,backdrop);sync();
  }
  hubNavigationSync?.();
  const sidebar=document.querySelector('.qiyan-sidebar-tools');
  if(sidebar&&pageId!=='p01'&&!sidebar.querySelector('[data-local-projects]'))action(sidebar,realIdentityMode?'我的研究设计':'我的课题与草稿',()=>goToPage('q02',{projectId:null,protocolId:null,assetId:null})).setAttribute('data-local-projects','true');
  const main=document.querySelector('main');
  let explicitDemo=false;try{explicitDemo=sessionStorage.getItem('lingshu-demo-mode')==='true';}catch{}
  const routeState=realModeRouteState(pageId,location.search,{configured:Boolean(import.meta.env.VITE_AUTH_TENANT_SLUG),explicitDemo});
  const teamMaintenance=pageId==='g02'&&new URLSearchParams(location.search).get('view')==='directory-review';
  const academicContent=(pageId==='g02'&&new URLSearchParams(location.search).get('view')==='academic-content')||(pageId==='h01'&&new URLSearchParams(location.search).get('section')==='updates');
  const hideCapability=academicContent||!showWorkspaceNotice(pageId,location.search,routeState)||(pageId==='ai01'&&main?.classList.contains('real-ai-workspace'));
  if(hideCapability)main?.querySelector('[data-demo-capability]')?.remove();
  if(main&&!hideCapability&&!main.querySelector('[data-demo-capability]')){const note=document.createElement('div');note.dataset.demoCapability='true';note.className='qiyan-demo-capability';const realEntry=main.classList.contains('real-workspace-entry');const assetDraft=isAssetDraftRoute(pageId,location.search);note.textContent=realEntry?"请选择你有权访问的研究。":assetDraft?"合成资产候选仅本人可见，未共享或发布。":pageId==='k01'?"仅可访问已授权资料，AI问答使用已审核内容。":pageId==='q01'&&new URLSearchParams(location.search).has('researchPlanId')?"合成研究草稿仅本人可见，不代表研究批准。":"演示模式 · 示例与浏览器内草稿不作为真实研究结果。";if(!realEntry){if(assetDraft){action(note,'我的候选列表',()=>location.assign('/pages/a01/?assetDrafts=1'));}else{action(note,'打开本机课题',()=>goToPage('q02',{projectId:null,protocolId:null,assetId:null}));action(note,'本机科研资产',()=>goToPage('a01',{view:'local',projectId:null,protocolId:null,assetId:null}));}}main.querySelector('.qiyan-page-context')?.after(note);if(!note.isConnected)main.prepend(note);}
  if(realIdentityMode){const note=main?.querySelector('[data-demo-capability]');if(note){note.replaceChildren();text(note,main?.classList.contains('real-workspace-entry')?"请选择你有权访问的研究。":pageId==='p01'?"查看你的研究与待办。":pageId==='s11'?"邀请仅限当前研究；体验邮件不向外发送。":pageId==='k01'?"资料与AI问答受当前研究授权及使用额度限制。":isAssetDraftRoute(pageId,location.search)?"合成资产候选仅本人可见，未共享、审批或发布。":pageId==='q01'&&new URLSearchParams(location.search).has('researchPlanId')?"合成研究草稿，不代表研究批准。":"当前页面仅显示你有权访问的内容。");}}
  if(realModeRouteState(pageId,location.search,{configured:Boolean(import.meta.env.VITE_AUTH_TENANT_SLUG),explicitDemo})==='live'&&['g02','e01','e02','h01','h05','c01','c03','h06'].includes(pageId)){
    const note=main?.querySelector('[data-demo-capability]');
    if(note){note.replaceChildren();text(note,pageId==='g02'?"从数据治理或快捷操作进入来源审核。":pageId==='h01'||pageId==='h05'?"浏览研究领域与已审核公开资料。":"当前仅显示获准使用的来源内容。");}
  }
  if(isResearchDesignRoute(pageId,location.search)){const note=main?.querySelector('[data-demo-capability]');if(note){note.replaceChildren();text(note,pageId==='q02'?"查看与完善本人的研究设计草稿。":"核对资料依据并完善本人的研究设计草稿。");}}
  if(isPreparationRoute(pageId,location.search)){const note=main?.querySelector('[data-demo-capability]');if(note){note.replaceChildren();text(note,"合成执行准备：仅保存本人配置草稿；试填不保存答案，不启动正式采集。");}}
  if(isSyntheticEdcRoute(pageId,location.search)){const note=main?.querySelector('[data-demo-capability]');if(note){note.replaceChildren();text(note,"当前研究的本人合成记录，不用于正式采集或研究放行。");}}
  if(isCrfMethodsRoute(pageId,location.search)){const note=main?.querySelector('[data-demo-capability]');if(note){note.replaceChildren();text(note,"合成CRF方法结果及报告，不代表疗效分析或研究放行；AI仅在主动发起时调用。");}}
  if(isCrfMethodAssetsRoute(pageId,location.search)){const note=main?.querySelector('[data-demo-capability]');if(note){note.replaceChildren();text(note,'方法资产候选来自真实会话与本人固定报告版本。历史证据和复用准备分开；未共享、未审批，不创建新研究或调用AI。');}}
  if(isAssetApplicabilityRoute(pageId,location.search)){const note=main?.querySelector('[data-demo-capability]');if(note){note.replaceChildren();text(note,"对照资产与目标方案，分别查看AI结果和人工意见；不自动应用、共享或批准。AI按使用额度计量。");}}
  if(isAssetDraftRoute(pageId,location.search)){const note=main?.querySelector('[data-demo-capability]'),p=new URLSearchParams(location.search);try{const url=makeCrfMethodAssetUrl('a01',{studyGroupId:p.get('studyGroupId'),researchProjectId:p.get('researchProjectId')});if(note&&!note.querySelector('[data-method-candidates]'))action(note,'返回我的方法资产候选',()=>location.assign(url)).setAttribute('data-method-candidates','true');}catch{/* Missing scope is not inferred from demo context. */}}
}
