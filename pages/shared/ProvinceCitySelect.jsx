import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createDivisionClient} from '../../src/administrative-divisions.js';
import {Button} from './Components.jsx';
export default function ProvinceCitySelect({value,city='',region='',onChange,disabled=false}){
 const client=useMemo(()=>createDivisionClient(),[]),[provinces,setProvinces]=useState([]),[cities,setCities]=useState([]),[version,setVersion]=useState(''),[provinceOnly,setProvinceOnly]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0),onChangeRef=useRef(onChange),valueRef=useRef(value);onChangeRef.current=onChange;valueRef.current=value;
 useEffect(()=>{let live=true;client.invalidate();setLoading(true);setError('');setCities([]);setProvinceOnly(false);
  (async()=>{const p=await client.list();if(!live)return;setProvinces(p.items);setVersion(p.version);
   if(value?.provinceCode){const c=await client.list(value.provinceCode);if(!live)return;if(c.version!==p.version||value.version!==p.version)throw Error('字典版本已变化，请清除原选择后重新选择。');setCities(c.items);setProvinceOnly(c.provinceOnly===true);
    if(c.provinceOnly&&valueRef.current?.provinceCode===value.provinceCode&&!valueRef.current.cityCode){const province=p.items.find(x=>x.code===value.provinceCode);if(province)onChangeRef.current({location:{version:p.version,provinceCode:province.code,cityCode:null},city:province.name,region:province.name});}
   }
  })().catch(e=>{if(live&&e.name!=='AbortError')setError(e.message);}).finally(()=>{if(live)setLoading(false);});
  return()=>{live=false;client.invalidate();};
 },[client,value?.provinceCode,retry]);
 function chooseProvince(code){const p=provinces.find(x=>x.code===code);setCities([]);setProvinceOnly(false);onChange(p?{location:{version,provinceCode:p.code,cityCode:null},region:p.name,city:''}:{location:null,region:'',city:''});}
 function chooseCity(code){const c=cities.find(x=>x.code===code),p=provinces.find(x=>x.code===value?.provinceCode);if(p)onChange({location:{version,provinceCode:p.code,cityCode:c?.code??null},region:p.name,city:c?.name??''});}
 return <div className="province-city-select"><div className="team-form-row">
  <label>省份（选填）<select aria-label="省份（选填）" value={value?.provinceCode??''} disabled={disabled||loading||!!error} onChange={e=>chooseProvince(e.target.value)}><option value="">请选择省份</option>{provinces.map(p=><option key={p.code} value={p.code}>{p.name}</option>)}</select></label>
  <label>城市／地区（选填）<select aria-label="城市／地区（选填）" value={value?.cityCode??''} disabled={disabled||loading||!!error||!value?.provinceCode||provinceOnly} onChange={e=>chooseCity(e.target.value)}><option value="">{provinceOnly?'原数据仅提供省级地区':'请选择城市／地区'}</option>{cities.map(c=><option key={c.code} value={c.code}>{c.name}</option>)}</select></label>
 </div>{loading&&<p role="status">正在加载省市…</p>}{error&&<p role="alert">{error}<Button disabled={disabled} onClick={()=>setRetry(n=>n+1)}>重试省市加载</Button></p>}
 {!value&&(city||region)&&<p className="team-helper">原保存地区：{[region,city].filter(Boolean).join(' / ')}。选择新省市后才替换。</p>}
 {provinceOnly&&<p className="team-helper">该版本原始数据未细分城市，保留省级地区，不推测下级。</p>}
 {(value||city||region)&&<Button disabled={disabled} variant="ghost" onClick={()=>onChange({location:null,city:'',region:''})}>清除省市</Button>}
 </div>;
}
