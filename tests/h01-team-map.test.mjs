import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
import {createDirectoryClient} from '../src/directory-session.js';
const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'});after(()=>server.close());
const point=(city,cityCode,longitude,latitude,teamCount=1)=>({city,cityCode,longitude,latitude,teamCount,coordinateKind:'CITY_REFERENCE'});
const map={matchedTeamCount:3,mappedTeamCount:3,unmappedTeamCount:0,regionMappedTeamCount:0,cities:[point('北京市','110000',116.407526,39.90403),point('大连市','210200',121.6,38.9),point('上海市','310000',121.46916666666667,31.2325)],regions:[],dataRevision:'a'.repeat(64)};
async function render(props={}){const {default:View}=await server.ssrLoadModule('/pages/shared/HubTeamMapView.jsx');return renderToStaticMarkup(React.createElement(View,{map,...props,onRetry:()=>{}}));}
test('H01 renders actual map DTO as three team markers, truthful counts and the T01 detail action',async()=>{
 const html=await render();assert.equal((html.match(/<circle[^>]*data-count=/g)??[]).length,3);assert(html.includes('研究团队分布'));assert(!html.includes('研究机构'));assert(html.includes('大连市'));assert(html.includes('团队数'));assert(html.includes('城市参考点不代表团队精确地址'));assert(html.includes('href="/pages/t01/?view=map"'));assert(!html.includes('42</strong>'));
});
test('same-city source/reference points remain two markers but one summed city ranking; regions never become cities',async()=>{
 const m={...map,matchedTeamCount:7,mappedTeamCount:7,cities:[point('北京市','110000',116.407526,39.90403,2),{city:'北京市',longitude:116.42,latitude:39.92,teamCount:1,coordinateKind:'SOURCE_LOCATION'}],regions:[{region:'辽宁省',regionCode:'210000',longitude:122.6,latitude:41.29,teamCount:4,coordinateKind:'REGION_ANCHOR'}],regionMappedTeamCount:4};
 const html=await render({map:m});assert.equal((html.match(/<circle[^>]*data-count=/g)??[]).length,3);assert.equal((html.match(/<li>/g)??[]).length,1);assert(html.includes('北京市<strong>3</strong>'));assert(html.includes('省级地区汇总'));assert(!html.includes('辽宁省<strong>'));
});
test('empty, unlocated, loading, unavailable and error states never show stale private markers or demo values',async()=>{
 const empty=await render({map:{...map,matchedTeamCount:0,mappedTeamCount:0,cities:[]}});assert(!/data-count=/.test(empty));assert(empty.includes('暂无已审核团队'));
 const unlocated=await render({map:{...map,mappedTeamCount:0,unmappedTeamCount:3,cities:[]}});assert(!/data-count=/.test(unlocated));assert(/未定位\s*3\s*个/.test(unlocated));
 for(const props of [{loading:true},{error:'读取失败，请重试。'}]){const html=await render(props);assert(!/data-count=/.test(html));assert(!html.includes('北京市'));assert(!html.includes('TOP 5'));}
 assert((await render({error:'读取失败，请重试。'})).includes('重新加载'));
});
test('H01 uses the existing public/member same-origin GET and invalidates late identity responses',async()=>{
 const seen=[],c=createDirectoryClient({fetchImpl:async(path,init)=>{seen.push({path,init});return Response.json(map);}});
 assert.equal((await c.map({},'public')).matchedTeamCount,3);assert.equal((await c.map({},'tenant')).cities[1].city,'大连市');
 assert.deepEqual(seen.map(s=>s.path),['/api/hubs/lingshu-xinyu/teams/map','/api/hubs/lingshu-xinyu/member/teams/map']);assert(seen.every(s=>s.init.method==='GET'&&s.init.credentials==='same-origin'&&s.init.cache==='no-store'));
 const late=createDirectoryClient({fetchImpl:async()=>({ok:true,json:async()=>{late.invalidate();return map;}})});await assert.rejects(late.map({},'tenant'),{name:'AbortError'});
});
test('broken map DTO is rejected instead of inventing counts, accepting NaN or leaking raw errors',async()=>{
 const {validateHubTeamMap}=await import('../src/hub-team-map.js');assert.equal(validateHubTeamMap(map),map);
 for(const change of [m=>m.cities=null,m=>m.matchedTeamCount=-1,m=>m.mappedTeamCount=9,m=>m.cities[0].longitude=NaN,m=>m.cities[0].teamCount=1.5,m=>m.cities[0].coordinateKind='UNKNOWN',m=>m.regions.push({})]){
  const m=structuredClone(map);change(m);assert.throws(()=>validateHubTeamMap(m),/团队分布数据暂不可用/);
 }
});
test('an unsupported Hub never offers a misleading detail link into the LingShu team map',async()=>{
 const html=await render({map:null,error:'此领域尚无可用的团队分布。',detailsAvailable:false});assert(!html.includes('href="/pages/t01/'));assert(html.includes('disabled=""'));assert(html.includes('此领域尚无可用的团队分布'));
});
