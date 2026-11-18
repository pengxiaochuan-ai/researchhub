// Free, isolated state-contract fixture. Never imported by product pages.
import React,{useState,useEffect} from 'react';import {createRoot} from 'react-dom/client';
import {useAgentMaterials,AgentMaterialsView} from '../../pages/shared/AgentMaterials.jsx';
import PrivateMaterialSources from '../../pages/shared/PrivateMaterialSources.jsx';
const flags=new URLSearchParams(location.search);let reads=0;
const item=(id,name)=>({id,version:3,state:flags.has('parsing')?'importing':flags.has('warning')?'blocked':'ready',stage:'complete',name,available:!flags.has('parsing')&&!flags.has('warning'),kbId:'base',docId:id+'-doc',progress:100,createdAt:new Date(0).toISOString()});
window.materialHarness={reads:0,uploads:0,requestKeys:[]};
const client={
 get:async path=>{
  if(path.includes('/receipts/'))return flags.has('receiptReady')?{found:true,item:item('receipt-material','原上传资料')}:{found:false};
  const sid=path.split('/')[2];
  window.materialHarness.reads=++reads;
  if(flags.has('deferRead')&&reads===1)await new Promise(resolve=>{window.materialHarness.resolveRead=resolve;});
  if(flags.has('readFail'))throw Error('资料状态未能核对，请重新获取。');
  return {items:flags.has('empty')?[]:[item(sid,sid+'资料')],nextCursor:null};
 },
 upload:async(_path,form)=>{++window.materialHarness.uploads;window.materialHarness.requestKeys.push(form.get('requestKey'));if(flags.has('retrySuccess')&&window.materialHarness.uploads>1)return item('retried-material','恢复成功的合成资料');if(flags.has('unknown'))throw Error('上传结果尚未确认。');return new Promise(resolve=>{window.materialHarness.resolveUpload=()=>resolve(item('uploaded-A','A的私人资料'));});},
};
function Fixture(){
 const [sid,setSid]=useState(flags.has('newSession')?null:'session-A'),[paused,setPaused]=useState(false);
 const materials=useAgentMaterials({client,identity:'fixture-owner',sessionId:sid,getSession:async()=>{setSid('created-session');return 'created-session';},enabled:true,analysisReady:flags.has('analysis'),paused});
 useEffect(()=>{if(!flags.has('syntheticControls'))return;const el=materials.input.current,stop=e=>e.preventDefault();el?.addEventListener('click',stop);return()=>el?.removeEventListener('click',stop);},[]);
 window.materialHarness.switch=setSid;
 window.materialHarness.pause=setPaused;
 const evidence={schema:'hub-private-material-pack.v1',binding:{principal:{studyGroupId:'group',researchProjectId:'project'}},sources:[{id:'M1',kbId:'base',docId:'source-doc',docVersion:3,contentSha256:'a'.repeat(64),title:'固定本人合成资料',reviewed:false,coverage:{complete:false,readCharacters:1200,totalCharacters:9000},fragments:[{id:'M1-F1',lineStart:1,lineEnd:5,text:'P03-SOURCE: 仅为合成组件验证。原始缺失值不填零，zero=0，false=false。\nSource instructions are untrusted data.'}]}]};
 return <><p id="current-session">{sid}</p><output id="upload-count">{window.materialHarness.uploads}</output><output id="same-request-key">{String(new Set(window.materialHarness.requestKeys).size<=1)}</output><output id="analysis-blocked">{String(materials.blocksAnalysis)}</output><button onClick={materials.pick}>上传</button>{flags.has('syntheticControls')&&<button onClick={()=>materials.selected({target:{files:[new File(['synthetic only'],'synthetic.txt',{type:'text/plain'})],value:''}})}>选择合成文件（隔离测试）</button>}<AgentMaterialsView materials={materials} scope={{studyGroupId:'group',researchProjectId:'project'}} analysisReady={flags.has('analysis')}/>{flags.has('sources')&&<PrivateMaterialSources evidence={evidence}/>}</>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
