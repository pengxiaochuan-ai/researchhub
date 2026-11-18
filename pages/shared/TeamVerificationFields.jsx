import React,{useEffect,useState} from 'react';
import {Button} from './Components.jsx';
import {manualInstitutionKey} from '../../src/team-review-flow.js';

export default function TeamVerificationFields({data,client,onState,refresh=0}){
 const key=manualInstitutionKey(data),[state,setState]=useState(null),[retry,setRetry]=useState(0);
 useEffect(()=>{
  let live=true;const ids=JSON.parse(key??'[]');onState?.({key,ready:ids.length===0});setState(null);
  if(ids.length)Promise.all(ids.map(id=>client.entity(id))).then(items=>{if(live){setState({key,items});onState?.({key,ready:true,items,snapshots:items.flatMap(item=>{const p=item.facts.find(f=>f.kind==='profile');return p?[{id:item.item.id,profile:p.payload}]:[]})});}}).catch(e=>{if(live&&e.name!=='AbortError'){setState({key,error:'关联机构暂未读全，团队输入已保留；请重新读取后审核。'});onState?.({key,ready:false});}});
  return()=>{live=false;};
 },[key,client,onState,retry,refresh]);
 const ids=JSON.parse(key??'[]'),current=state?.key===key?state:null;
 return ids.length>0&&!current?<p role="status">正在读取机构资料…</p>:current?.error?<p role="alert">{current.error}<Button onClick={()=>setRetry(x=>x+1)}>重新读取机构</Button></p>:null;
}
