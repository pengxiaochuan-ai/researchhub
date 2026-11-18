import React,{useEffect,useMemo,useState} from 'react';
import {createDirectoryClient} from '../../src/directory-session.js';
import {validateHubTeamMap} from '../../src/hub-team-map.js';
import {useDirectoryIdentity,directoryMessage} from './DirectoryState.jsx';
import HubTeamMapView from './HubTeamMapView.jsx';

export default function HubTeamMap({hubKey}){
 const client=useMemo(()=>createDirectoryClient(),[]),{checking,unavailable,audience,identityKey}=useDirectoryIdentity();
 const [result,setResult]=useState(null),[error,setError]=useState(null),[loading,setLoading]=useState(true),[refresh,setRefresh]=useState(0);
 useEffect(()=>{
  client.invalidate();setResult(null);setError(null);setLoading(true);
  if(checking)return;
  if(unavailable||hubKey!=='lingshu-xinyu'){setError(Error(unavailable?'身份暂不可核验，请重新加载；未显示此前团队数据。':'此领域尚无可用的团队分布。'));setLoading(false);return;}
  let active=true;
  client.map({},audience).then(validateHubTeamMap).then(map=>{if(active)setResult({map,identityKey,hubKey});}).catch(e=>{if(active&&e.name!=='AbortError')setError(e);}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;client.invalidate();};
 },[client,hubKey,checking,unavailable,audience,identityKey,refresh]);
 const current=!checking&&!unavailable&&result?.identityKey===identityKey&&result?.hubKey===hubKey?result.map:null;
 return <HubTeamMapView map={current} loading={checking||loading} error={!checking&&error?directoryMessage(error):''} onRetry={()=>setRefresh(v=>v+1)} detailsAvailable={hubKey==='lingshu-xinyu'}/>;
}
