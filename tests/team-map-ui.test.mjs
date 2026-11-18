import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'});after(()=>server.close());
async function render(map,rows=[]){const {default:TeamMap}=await server.ssrLoadModule('/pages/shared/TeamDirectoryMap.jsx');return renderToStaticMarkup(React.createElement(TeamMap,{shape:'M0 0Z',project:(x,y)=>[x,y],map,rows,open:()=>{}}));}
test('city reference markers clearly differ from reviewed exact source locations without new controls',async()=>{
 const html=await render({matchedTeamCount:1,unmappedTeamCount:0,cities:[{city:'大连市',cityCode:'210200',longitude:121.6,latitude:38.9,coordinateKind:'CITY_REFERENCE',teamCount:1}],regions:[]});
 assert(html.includes('大连市 1'));assert(html.includes('城市参考点'));assert(html.includes('不代表团队精确地址'));assert(!html.includes('已审核来源位置'));assert.equal((html.match(/<circle/g)??[]).length,1);
});
test('actual map renders region markers with honest geography and retains the team detail action',async()=>{
 const html=await render({matchedTeamCount:3,unmappedTeamCount:0,cities:[],regions:[{region:'北京市',regionCode:'110000',longitude:116.42,latitude:40.19,coordinateKind:'REGION_ANCHOR',teamCount:1},{region:'辽宁省',regionCode:'210000',longitude:122.60,latitude:41.29,coordinateKind:'REGION_ANCHOR',teamCount:2}]},[{id:'team1',city:'大连市',name:'已审核团队'}]);
 assert.equal((html.match(/<circle/g)??[]).length,2);assert(html.includes('辽宁省 2'));assert(html.includes('cx="122.6"'));assert(html.includes('省级地区汇总'));assert(html.includes('不代表团队精确地址'));assert(html.includes('已审核团队</button>'));assert(html.includes('id="team-team1"'));
});
test('old city responses still render, with no province claim or invented markers in an empty map',async()=>{
 const city=await render({matchedTeamCount:1,unmappedTeamCount:0,cities:[{city:'北京',longitude:116.4,latitude:39.9,coordinateKind:'CITY_CENTROID',teamCount:1}]});assert.equal((city.match(/<circle/g)??[]).length,1);assert(city.includes('城市聚合位置'));assert(!city.includes('省级地区汇总'));
 const empty=await render({matchedTeamCount:0,unmappedTeamCount:0,cities:[],regions:[]});assert(!empty.includes('<circle'));assert(empty.includes('暂无已审核团队'));assert(!empty.includes('省级地区汇总'));
});
test('map marker accessible titles render as a single string without React hydration warnings',async()=>{
 const errors=[],original=console.error;console.error=(...args)=>errors.push(args.map(String).join(' '));
 try{await render({matchedTeamCount:1,unmappedTeamCount:0,cities:[],regions:[{region:'北京市',regionCode:'110000',longitude:116.42,latitude:40.19,coordinateKind:'REGION_ANCHOR',teamCount:1}]});}finally{console.error=original;}
 assert.deepEqual(errors,[]);
});
