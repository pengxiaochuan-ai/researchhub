import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPageRoute,safeReturnTo} from '../src/route-context.js';
import {createDemoStore} from '../src/demo-research-store.js';

function memory(){const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};}
const fixture={name:'针灸维持治疗研究',question:'是否改善12个月复发率？',pico:{p:'缓解期患者',i:'针灸',c:'随访',o:'12个月复发率'},hubId:'HUB-MOOD',opportunityId:'OP-2026-017'};
test('跨页保留合法研究上下文，拒绝未知目标及外部返回地址',()=>{
  assert.equal(buildPageRoute({s07:'/pages/s07/'},'s07',{projectId:'PRJ-1',password:'secret'}),'/pages/s07/?projectId=PRJ-1');
  assert.equal(safeReturnTo('https://other.example/'),'/pages/q02/');
  assert.equal(safeReturnTo('//other.example/'),'/pages/q02/');
  assert.equal(safeReturnTo('/pages/s07/?projectId=PRJ-1'),'/pages/s07/?projectId=PRJ-1');
  assert.throws(()=>buildPageRoute({},'missing',{}));
});
test('课题持久化，刷新恢复且方案继承名称与PICO',()=>{
  const storage=memory(),store=createDemoStore(storage);
  const project=store.saveProject(fixture);
  const fresh=createDemoStore(storage);
  assert.equal(fresh.get('projects',project.id).name,fixture.name);
  const protocol=fresh.ensureProtocol(project.id);
  assert.deepEqual(protocol.pico,fixture.pico);
  assert.equal(protocol.name,fixture.name);
  assert.equal(fresh.ensureProtocol(project.id).id,protocol.id);
});
test('不完整PICO不能创建方案，未知ID不能跳到其他示例',()=>{
  const store=createDemoStore(memory());
  const project=store.saveProject({...fixture,pico:{...fixture.pico,o:''}});
  assert.throws(()=>store.ensureProtocol(project.id),/结局/);
  assert.throws(()=>store.get('projects','unknown'),/不存在/);
});
test('存储失败不会产生已保存记录',()=>{
  const store=createDemoStore({getItem:()=>null,setItem:()=>{throw Error('quota');}});
  assert.throws(()=>store.saveProject(fixture),/保存失败/);
  assert.equal(store.list('projects').filter(item=>item.name===fixture.name).length,0);
});
test('产出发布与复用保留来源版本、目标及独立对象',()=>{
  const store=createDemoStore(memory()),project=store.saveProject(fixture),protocol=store.ensureProtocol(project.id);
  const output=store.saveOutput({projectId:project.id,protocolId:protocol.id,title:'研究摘要',content:'专家确认的演示文稿',confirmed:true});
  const asset=store.publishOutput(output.id);
  const target=store.saveProject({...fixture,name:'下一次研究'});
  const reused=store.reuseAsset(asset.id,target.id);
  assert.equal(reused.projectId,target.id);
  assert.equal(reused.sourceAssetId,asset.id);
  assert.equal(reused.sourceVersion,asset.version);
  assert.equal(store.get('assets',asset.id).sourceOutputId,output.id);
  assert.equal(store.get('projects',project.id).name,fixture.name);
  assert.equal(store.publishOutput(output.id).id,asset.id);
});
test('未确认产出不能发布且存储损坏不被静默覆盖',()=>{
  const storage=memory(),store=createDemoStore(storage),project=store.saveProject(fixture),protocol=store.ensureProtocol(project.id);
  const output=store.saveOutput({projectId:project.id,protocolId:protocol.id,title:'草稿',content:'演示',confirmed:false});
  assert.throws(()=>store.publishOutput(output.id),/确认/);
  assert.throws(()=>createDemoStore({getItem:()=>'{invalid',setItem:()=>{}}),/损坏/);
});
test('两个已打开的数据服务交替保存不丢失其他页面记录',()=>{
  const storage=memory(),one=createDemoStore(storage),project=one.saveProject(fixture),two=createDemoStore(storage);
  one.saveTask({projectId:project.id,title:'核对任务'});
  two.saveMember({projectId:project.id,name:'演示协调员',role:'协调员'});
  const fresh=createDemoStore(storage);
  assert.equal(fresh.list('tasks').length,1);
  assert.equal(fresh.list('members').length,1);
});
test('复用提交失败整体保持不变，重试仍可完整写入来源记录',()=>{
  const storage=memory(),store=createDemoStore(storage),project=store.saveProject(fixture),protocol=store.ensureProtocol(project.id);
  const asset=store.saveAsset({title:'演示资产',content:'演示内容'});
  const before=store.get('protocols',protocol.id),write=storage.setItem;
  storage.setItem=()=>{throw Error('quota');};
  assert.throws(()=>store.reuseAsset(asset.id,project.id),/保存失败/);
  storage.setItem=write;
  assert.deepEqual(store.get('protocols',protocol.id),before);
  assert.equal(store.list('reuses').length,0);
  store.reuseAsset(asset.id,project.id);
  assert.equal(store.list('reuses').length,1);
});
test('保存部分课题更新保留已有来源和状态，旧方案版本不能覆盖新版本',()=>{
  const store=createDemoStore(memory()),project=store.saveProject({...fixture,hubId:'HUB-OTHER',opportunityId:'OP-OTHER',status:'已确认'});
  const updated=store.saveProject({id:project.id,name:'修改名称'});
  assert.equal(updated.hubId,'HUB-OTHER');assert.equal(updated.status,'已确认');
  const first=store.ensureProtocol(project.id);
  store.saveProtocol({...first,design:'新版本'});
  assert.throws(()=>store.saveProtocol({...first,design:'过期版本'}),/版本/);
});
test('方案更新与复用血缘只执行一次完整存储提交',()=>{
  const storage=memory(),store=createDemoStore(storage),project=store.saveProject(fixture);store.ensureProtocol(project.id);
  const asset=store.saveAsset({title:'单次提交验证',content:'演示内容'}),write=storage.setItem;
  let calls=0;storage.setItem=(...args)=>{calls++;if(calls===2)throw Error('second write fails');return write(...args);};
  store.reuseAsset(asset.id,project.id);
  assert.equal(calls,1);assert.equal(store.list('reuses').length,1);
});
