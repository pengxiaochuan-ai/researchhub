import React from 'react';
import {MapPin} from 'lucide-react';
import china from '../h01/src/china.json';

// Preserve the approved H01 map frame and projection. Points come only from
// the directory API; this is not a city/address geocoder.
const project=(lon,lat)=>[6+(lon-73.4)/(135.2-73.4)*250,4+(53.7-lat)/(53.7-17.8)*220];
const shape=china.features.flatMap(f=>(f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates).flatMap(p=>p.filter(r=>Math.max(...r.map(v=>v[1]))>=17.6).map(r=>r.map(([lon,lat],i)=>{const[x,y]=project(lon,lat);return`${i?'L':'M'}${x.toFixed(1)} ${y.toFixed(1)}`;}).join('')+'Z'))).join('');
const opacity=n=>n>=20?1:n>=10?.72:n>=5?.48:.28;
export default function HubTeamMapView({map,loading=false,error='',onRetry,detailsAvailable=true}){
 const current=!loading&&!error?map:null,cities=current?.cities??[],regions=current?.regions??[];
 const totals=new Map();for(const p of cities)totals.set(p.city,(totals.get(p.city)??0)+p.teamCount);
 const ranks=[...totals].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'zh')).slice(0,5);
 const points=[...cities.map(p=>({...p,name:p.city})),...regions.map(p=>({...p,name:p.region}))];
 const basis=p=>p.coordinateKind==='REGION_ANCHOR'?'省级地区汇总，不代表团队精确地址':p.coordinateKind==='CITY_REFERENCE'?'城市参考点，不代表团队精确地址':p.coordinateKind==='CITY_CENTROID'?'城市聚合位置，不代表团队精确地址':'已审核来源位置';
 return <article className="hub-card hub-team-map" aria-label="研究团队分布" aria-busy={loading}>
  <header><h2><MapPin size={16} aria-hidden="true"/>研究团队分布</h2>{detailsAvailable?<a href="/pages/t01/?view=map" aria-label="查看研究团队地图详情">查看详情</a>:<button type="button" disabled>查看详情</button>}</header>
  {current&&<p className="hub-note">当前已审核团队 {current.matchedTeamCount} 个；未定位 {current.unmappedTeamCount} 个。{cities.some(p=>p.coordinateKind==='CITY_REFERENCE')&&'城市参考点不代表团队精确地址。'}{regions.length>0&&'省级地区汇总不代表团队精确地址。'}{cities.some(p=>p.coordinateKind==='CITY_CENTROID')&&'城市聚合位置不代表团队精确地址。'}</p>}
  <div className="hub-map">
   {loading?<p className="real-hub-state" role="status">正在读取团队分布…</p>:error?<p className="real-hub-state" role="alert">{error}<button type="button" onClick={onRetry}>重新加载</button></p>:current?<>
    <svg viewBox="2 0 258 228" role="img" aria-label={`当前已审核研究团队分布，匹配${current.matchedTeamCount}个，未定位${current.unmappedTeamCount}个`}><path className="land" d={shape}/>{points.map((p,i)=>{const[x,y]=project(p.longitude,p.latitude);return <circle key={p.coordinateKind+'-'+(p.cityCode??p.regionCode??p.name)+'-'+i} cx={x} cy={y} r="3.5" data-count={p.teamCount} style={{fillOpacity:opacity(p.teamCount)}}><title>{`${p.name}：${p.teamCount}个团队，${basis(p)}`}</title></circle>;})}</svg>
    <p className="hub-scale" aria-label="标记深浅对应团队数量">{[['≥20',1],['10–19',.72],['5–9',.48],['1–4',.28]].map(([label,alpha])=><span key={label}><i style={{opacity:alpha}}/>{label}</span>)}</p>
    <div className="hub-rank"><b>TOP 5 城市</b><small>团队数</small>{ranks.length?<ol>{ranks.map(([name,count],i)=><li key={name}><em>{i+1}</em>{name}<strong>{count}</strong></li>)}</ol>:<p>{current.matchedTeamCount===0?'暂无已审核团队。':'暂无可定位城市。'}</p>}</div>
   </>:null}
  </div>
 </article>;
}
