import SouthChinaSeaInset from './SouthChinaSeaInset.jsx';
import React from 'react';

export default function TeamDirectoryMap({shape,project,map,rows,open}){
 const cities=map?.cities??[],regions=map?.regions??[];
 return <section className="team-map">
  <svg viewBox="0 0 680 500" role="img" aria-label="当前全部筛选结果的团队分布，含南海诸岛附图">
   <path d={shape}/>
   {cities.map(p=>{const[x,y]=project(p.longitude,p.latitude);return <g key={'city-'+p.coordinateKind+'-'+(p.cityCode??p.city)}><title>{`${p.city}：${p.teamCount}个团队，${p.coordinateKind==='CITY_REFERENCE'?'城市参考点，不代表团队精确地址':p.coordinateKind==='CITY_CENTROID'?'城市聚合位置':'已审核来源位置'}`}</title><circle cx={x} cy={y} r={6}/><text x={x+10} y={y+4}>{p.city} {p.teamCount}</text></g>;})}
   {regions.map(p=>{const[x,y]=project(p.longitude,p.latitude);return <g key={'region-'+p.regionCode}><title>{`${p.region}：${p.teamCount}个团队，省级地区汇总，不代表团队精确地址`}</title><circle cx={x} cy={y} r={6}/><text x={x+10} y={y+4}>{p.region} {p.teamCount}</text></g>;})}
   <SouthChinaSeaInset x={550} y={346} scale={2} />
  </svg>
  <ul><li>全部匹配 {map?.matchedTeamCount} 个；未定位 {map?.unmappedTeamCount} 个。{regions.length>0&&'省级地区汇总标记不代表团队精确地址。'}{cities.some(p=>p.coordinateKind==='CITY_REFERENCE')&&'城市参考点不代表团队精确地址。'}{cities.some(p=>p.coordinateKind==='CITY_CENTROID')&&'城市聚合位置不代表团队精确地址。'}{map?.unmappedTeamCount>0&&'缺少可用位置的团队仍列于下方。'}</li>
   {rows.map(team=><li key={team.id} id={'team-'+team.id}><b>{team.city??'地区待核验'}</b><button type="button" onClick={()=>open(team.id)}>{team.name}</button></li>)}
   {!rows.length&&<li>暂无已审核团队。</li>}
  </ul>
 </section>;
}
