import React,{useEffect,useMemo,useState} from 'react';
import {createDirectoryClient,safeResearcherReturn} from '../../src/directory-session.js';
import {researcherProfile} from '../../src/researcher-profile.js';
import {useDirectoryIdentity,directoryMessage} from './DirectoryState.jsx';
export default function ResearcherDetail({Profile}){
 const p=new URLSearchParams(location.search),id=p.get('id'),back=safeResearcherReturn(p.get('returnTo'));
 const[data,setData]=useState(null),[error,setError]=useState(null),[loading,setLoading]=useState(true),[refresh,setRefresh]=useState(0);
 const client=useMemo(()=>createDirectoryClient(),[]),{checking,unavailable,audience,identityKey}=useDirectoryIdentity();
 useEffect(()=>{client.invalidate();setData(null);setLoading(true);if(checking)return;if(unavailable){setError(Error('暂时无法核验登录状态，请重新加载后重试。'));setLoading(false);return;}let active=true;
  (async()=>{if(!id||!/^[A-Za-z0-9_-]{1,160}$/.test(id)||[...p.keys()].some(k=>!['id','returnTo','hubId'].includes(k)||p.getAll(k).length!==1)||p.has('hubId')&&p.get('hubId')!=='lingshu-xinyu')throw Error('研究者标识或访问地址无效，请从目录重新进入。');const result=await client.researcher(id,audience);if(active){setData({person:researcherProfile(result.item),identityKey});setError(null);}})().catch(e=>{if(active&&e.name!=='AbortError')setError(e);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;client.invalidate();};
 },[client,id,audience,identityKey,checking,unavailable,refresh]);
 const person=!checking&&!unavailable&&data?.identityKey===identityKey?data.person:null;
 if(!person||loading||error)return <main className="platform-main profile-board" aria-busy={loading}><section className="profile-hero"><div role={error?'alert':'status'}><p>{loading?'正在读取已审核研究者详情…':directoryMessage(error)||'该研究者当前不可访问。'}</p>{error&&<button type="button" onClick={()=>setRefresh(v=>v+1)}>重新加载</button>}<a href={back}>返回研究者目录</a></div></section></main>;
 return <Profile key={identityKey+':'+id} person={person} back={back}/>;
}
