import test,{after} from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {createServer} from 'vite';import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'});after(()=>server.close());
test('province choices do not expose implementation provenance in the team form',async()=>{const {default:Select}=await server.ssrLoadModule('/pages/shared/ProvinceCitySelect.jsx');const html=renderToStaticMarkup(React.createElement(Select,{onChange:()=>{}}));assert(!html.includes('数据来源'));assert(!html.includes('此选择不替代'));assert(html.includes('请选择省份'));});
test('different newly entered institution names are not mislabeled as following the team',async()=>{const {TeamFields,emptyTeam}=await server.ssrLoadModule('/pages/shared/TeamWorkspaceFields.jsx');const html=renderToStaticMarkup(React.createElement(TeamFields,{data:{...emptyTeam(),organization:{entityId:null,name:'团队机构甲',type:''},members:[{key:'a',entityId:null,name:'成员乙',rank:'',role:'lead',organization:{entityId:null,name:'成员机构乙',type:''}}]},client:{},onChange:()=>{}}));assert(html.includes('所属机构：成员机构乙'));assert(!html.includes('所属机构：与团队一致'));});
test('automatic list refresh and pagination keep the applied search and offer recovery inside the editor',()=>{
 const source=readFileSync(new URL('../pages/shared/TeamDirectoryWorkbench.jsx',import.meta.url),'utf8');
 assert(source.includes('listing(q=listLocation.current.q,p=listLocation.current.page)'));
 assert(!source.includes('listing(query,page-'));
 assert(!source.includes('listing(query,page+'));
 assert(source.includes('{editorOpen&&ready&&listFailed&&listRecovery}'));
});
test('team maintenance has no browser default business confirmations while retaining unload protection',()=>{
 for(const file of ['TeamDirectoryWorkbench.jsx','TeamWorkspaceFields.jsx','DirectoryWorkbench.jsx']){
  const source=readFileSync(new URL('../pages/shared/'+file,import.meta.url),'utf8');
  assert(!/window\.(confirm|alert|prompt)\s*\(/.test(source),file);
 }
 assert(readFileSync(new URL('../pages/shared/TeamDirectoryWorkbench.jsx',import.meta.url),'utf8').includes("addEventListener('beforeunload'"));
});
test('team review removes the optional-evidence workflow in both modes without clearing historical inputs',async()=>{
 const {TeamFields}=await server.ssrLoadModule('/pages/shared/TeamWorkspaceFields.jsx');
 for(const verificationMethod of ['administrator','sources']){
  const data={name:'合成团队',members:[],directions:[],notes:'历史核对说明',verificationMethod,evidence:[{reference:{kind:'source_record',sourceId:'synthetic',rowId:'row',sourceHash:'a'.repeat(64),locator:'原始位置',fieldNames:['abstract']},targets:['team']}]},before=JSON.stringify(data);
  const html=renderToStaticMarkup(React.createElement(TeamFields,{data,client:{sources:()=>assert.fail('no source calls')},onChange:()=>assert.fail('no silent migration')}));
  for(const text of ['补充资料依据','查找资料','改按资料依据审核','待补材料说明'])assert(!html.includes(text),text);
  assert(html.includes('核实与审核'));assert.equal(JSON.stringify(data),before);
 }
});
test('single team form has three task sections, clear optional fields and no internal database controls',async()=>{
 const {TeamFields}=await server.ssrLoadModule('/pages/shared/TeamWorkspaceFields.jsx');
 const html=renderToStaticMarkup(React.createElement(TeamFields,{data:{name:'待完善团队',members:[],evidence:[],directions:[]},client:{},onChange:()=>{}}));
 for(const text of ['团队基本资料','负责人和成员','核实与审核','团队名称（必填）','添加人员'])assert(html.includes(text),text);
 for(const text of ['稳定标识','主体类型','事实类型','关系目标','新增事实'])assert(!html.includes(text),text);
 assert(html.includes('aria-label="团队简介（选填）"'));assert(!html.includes('补充资料依据（选填）'));assert(!html.includes('aria-label="待补材料说明（选填）"'),'optional evidence fields are mounted only when expanded');
});
test('inline review feedback shows blockers without duplicating already visible team fields or reason',async()=>{
 const {TeamWorkspacePreview}=await server.ssrLoadModule('/pages/shared/TeamWorkspaceFields.jsx');
 const html=renderToStaticMarkup(React.createElement(TeamWorkspacePreview,{preview:{data:{name:'甲',city:'合成市',region:'合成省',teamType:'合成团队类型',organization:{name:'合成机构',type:'合成机构类型'},members:[{key:'a',name:'甲',role:'lead',organization:{name:'成员所属新机构',type:'成员机构类型'}}]},issues:['缺少依据'],changes:[],canApprove:false},reason:'',confirmed:false}));
 assert(html.includes('缺少依据'));assert(!html.includes('拟展示内容'));assert(!html.includes('不是已展示结果'));assert(!html.includes('审核理由'));assert(!html.includes('type="checkbox"'));assert(html.includes('role="alert"'));
 for(const value of ['合成市','合成省','合成团队类型','合成机构类型','成员所属新机构','成员机构类型'])assert(!html.includes(value),value);
});
test('organization uses a dropdown only and hides redundant edit fields for an existing organization',async()=>{
 const {TeamFields}=await server.ssrLoadModule('/pages/shared/TeamWorkspaceFields.jsx');
 const html=renderToStaticMarkup(React.createElement(TeamFields,{data:{name:'团队',members:[],evidence:[],directions:[],organization:{entityId:'org1',name:'已有机构',type:'研究所'}},client:{},onChange:()=>{}}));
 assert(!html.includes('团队所属机构检索'));assert(!html.includes('查找机构'));assert(!html.includes('value="已有机构" readonly=""'));assert(html.includes('已有机构'));assert(html.includes('省份（选填）'));assert(html.includes('城市／地区（选填）'));
});
test('team selection is an accessible list table with separate approval and visible-content states',async()=>{
 const {TeamWorkspaceList}=await server.ssrLoadModule('/pages/shared/TeamWorkspaceList.jsx');
 const html=renderToStaticMarkup(React.createElement(TeamWorkspaceList,{items:[{id:'a',name:'很长的待审团队',hasDraft:true,hasPublished:true,reviewed:false,savedAt:'2026-11-04T01:00:00Z'}],selected:'a',onSelect:()=>{}}));
 for(const s of ['<table','团队名称','审核状态','展示状态','更新时间','审核：很长的待审团队','有待审修改','已展示'])assert(html.includes(s),s);assert(!html.includes('正在维护'));assert(!html.includes('维护资料'));assert(html.includes('aria-current="true"'));
});
test('actual review controls belong inside the review section and member name is not duplicated',async()=>{
 const {TeamFields,emptyTeam}=await server.ssrLoadModule('/pages/shared/TeamWorkspaceFields.jsx');const {TeamReviewControls}=await server.ssrLoadModule('/pages/shared/TeamReviewDialog.jsx');
 const html=renderToStaticMarkup(React.createElement(TeamFields,{data:{...emptyTeam(),name:'合成团队',members:[{key:'a',entityId:'person',name:'唯一姓名',role:'lead',rank:'',organization:null}]},client:{},onChange:()=>{},reviewControls:React.createElement(TeamReviewControls,{audience:'tenant',reason:'',onAudience:()=>{},onReason:()=>{}})}));
 const review=html.split('aria-label="核实与审核"')[1]?.split('</section>')[0];assert(review?.includes('审核展示范围'));assert(review.includes('审核备注（选填）'));assert.equal(html.split('唯一姓名').length-1,2,'one visible name plus unique remove accessible name');assert(html.includes('aria-label="移除：唯一姓名"'));assert(!html.includes('移除人员1</button>'));
});
test('team editor is a labelled in-page dialog with close and separate scrolling body/action area',async()=>{
 const {default:Dialog}=await server.ssrLoadModule('/pages/shared/TeamWorkspaceDialog.jsx');
 const html=renderToStaticMarkup(React.createElement(Dialog,{title:'团队审核',onClose:()=>{},footer:React.createElement('button',null,'审核通过并展示')},React.createElement('p',null,'团队内容')));
 for(const s of ['<dialog','aria-modal="true"','aria-labelledby','关闭审核弹窗','团队内容','team-workspace-dialog-body','team-workspace-dialog-footer'])assert(html.includes(s),s);
 const source=readFileSync(new URL('../pages/shared/TeamDirectoryWorkbench.jsx',import.meta.url),'utf8');assert(!source.includes('DirectoryWorkbench from'));assert(!source.includes('其他目录维护'));
});
test('shared member confirmation names its action and impact with a labelled in-page modal',async()=>{
 const {default:ConfirmDialog}=await server.ssrLoadModule('/pages/shared/ConfirmDialog.jsx');
 const html=renderToStaticMarkup(React.createElement(ConfirmDialog,{title:'移除团队人员？',confirmLabel:'移除人员',onConfirm:()=>{},onCancel:()=>{}},React.createElement('p',null,'移除合成人员；审核确认后才生效。')));
 for(const value of ['<dialog','aria-modal="true"','aria-labelledby','aria-describedby','移除团队人员？','移除人员','取消','审核确认后才生效'])assert(html.includes(value),value);
});
test('manual review has one explanation area and no optional-evidence workflow or method dropdown or repeated institution panel',async()=>{
 const {TeamFields,emptyTeam}=await server.ssrLoadModule('/pages/shared/TeamWorkspaceFields.jsx');
 const html=renderToStaticMarkup(React.createElement(TeamFields,{data:{...emptyTeam(),name:'合成团队'},client:{},onChange:()=>{}}));
 assert(html.includes('核实与审核'));assert(!html.includes('补充资料依据（选填）'));assert(!html.includes('aria-label="资料核实方式"'));assert(!html.includes('关联机构核对'));
});
