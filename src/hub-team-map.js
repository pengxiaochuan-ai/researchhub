// H01 consumes the existing map DTO; malformed data is an error, never an empty
// map or an opportunity to restore illustrative cities/counts.
export function validateHubTeamMap(map){
 const fail=()=>{throw Error('团队分布数据暂不可用，请重新加载。');},count=n=>Number.isSafeInteger(n)&&n>=0;
 if(!map||!Array.isArray(map.cities)||!Array.isArray(map.regions)||map.cities.length>100||map.regions.length>35||typeof map.dataRevision!=='string'||!['matchedTeamCount','mappedTeamCount','unmappedTeamCount','regionMappedTeamCount'].every(k=>count(map[k])))fail();
 for(const [items,kind]of [[map.cities,'city'],[map.regions,'region']])for(const p of items){
  if(!p||typeof p[kind]!=='string'||!p[kind]||!Number.isFinite(p.longitude)||Math.abs(p.longitude)>180||!Number.isFinite(p.latitude)||Math.abs(p.latitude)>90||!count(p.teamCount)||p.teamCount===0||!(kind==='city'?['CITY_REFERENCE','CITY_CENTROID','SOURCE_LOCATION']:['REGION_ANCHOR']).includes(p.coordinateKind))fail();
 }
 const regionCount=map.regions.reduce((sum,p)=>sum+p.teamCount,0),cityCount=map.cities.reduce((sum,p)=>sum+p.teamCount,0);
 if(regionCount!==map.regionMappedTeamCount||cityCount+regionCount!==map.mappedTeamCount||map.mappedTeamCount+map.unmappedTeamCount!==map.matchedTeamCount)fail();
 return map;
}
