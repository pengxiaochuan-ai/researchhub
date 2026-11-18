import React,{useState,useLayoutEffect} from 'react';import {createRoot} from 'react-dom/client';
import ResearchDataPreview,{useResearchData} from '../../pages/shared/ResearchDataPreview.jsx';
import HubAgentPanel from '../../pages/shared/HubAgentPanel.jsx';
const file={kind:'research-data',id:'file-synthetic',name:'P04-SYNTHETIC.csv',version:2,state:'ready',summary:{rowsRead:2,rejectedRows:0}};
const result={schema:'hub-research-data-summary.v1',confirmationReady:false,files:[{fileId:file.id,rowsRead:2,rejectedRows:0,issues:[],exceptions:[],fields:[{sheet:'量表',name:'score'},{sheet:'随访',name:'followup'}],sampleRows:[{sheet:'量表',rowNumber:2,values:['SYNTHETIC-FIRST']},{sheet:'随访',rowNumber:2,values:[false]}]}]};
const flags=new URLSearchParams(location.search),many=flags.has('many'),saved={id:'plan-synthetic',version:1,state:flags.has('invalid')?'invalid':'previewed',files:[{id:many?'last-batch-file':file.id,version:2}],result};
let resolveRead;const client={get:async path=>{if(window.dataHarness.failRead)throw Object.assign(Error('源文件已变化'),{status:409,code:'DATA_SOURCE_CHANGED'});if(path.includes('/other/'))return new Promise(resolve=>{resolveRead=()=>resolve(path.includes('research-data')?{items:[],nextCursor:null}:{item:null});});return path.includes('research-data')?(many?path.includes('cursor=')?{items:[{...file,id:'last-batch-file'}],nextCursor:null}:{items:Array.from({length:20},(_,i)=>({...file,id:'older-file-'+i})),nextCursor:'second-page'}:{items:[file],nextCursor:null}):{item:saved};},post:async(_path,body)=>{window.dataHarness.posts.push(body);if(window.dataHarness.failPreview)throw Object.assign(Error('批次超限'),{status:413,code:'DATA_PREFLIGHT_CAPACITY'});return saved;}};
window.dataHarness={snapshots:[],posts:[],release:()=>resolveRead?.()};
function Harness(){
 const [identity,setIdentity]=useState('owner'),[sid,setSid]=useState('own');const data=useResearchData({client,identity,sessionId:sid,enabled:true});
 useLayoutEffect(()=>{window.dataHarness.snapshots.push({identity,sid,text:document.querySelector('#data-output').textContent});},[identity,sid]);
 window.dataHarness.switchIdentity=()=>setIdentity('admin');window.dataHarness.switchSession=()=>setSid('other');
 window.dataHarness.refresh=()=>data.refresh();
 window.dataHarness.more=()=>data.more();window.dataHarness.nextCursor=data.nextCursor;window.dataHarness.items=data.items;window.dataHarness.preview=files=>data.preview('own',files);
 return <div id="data-output"><ResearchDataPreview data={data}/></div>;
}
const loading=new URLSearchParams(location.search).has('hubLoading');
if(loading)globalThis.fetch=async path=>{
 let value;if(path==='/api/agents')value=[{id:'research',type:'research'}];
 else if(path==='/api/knowledge/ai-status')value={quota:{blocked:false},materialUpload:{enabled:true,analysisReady:true,researchDataEnabled:true}};
 else if(path.includes('knowledge-state'))value=await new Promise(resolve=>{window.dataHarness.resolveSession=()=>resolve({messages:[],jobs:[],hubContext:{kind:'hub',sessionId:'session-loading'},quota:{blocked:false}});});
 else if(path.includes('data-preflights'))value={item:null};else value={items:[],nextCursor:null,total:0};
 return new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}});
};
createRoot(document.getElementById('root')).render(loading?<HubAgentPanel layout="workbench" sessionId="session-loading" user={{accountId:'owner',tenantId:'tenant',studyGroups:[{id:'group',researchProjects:[{id:'project'}]}]}}/>:<Harness/>);
