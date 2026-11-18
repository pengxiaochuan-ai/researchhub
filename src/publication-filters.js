// Shared enum contract; filters never infer classifications in the browser.
export const PUBLICATION_FACETS = {
 types:[['original','原创研究'],['systematic','系统综述 / Meta分析'],['review','综述'],['methods','方法学研究'],['editorial','编辑评论'],['other','其他']],
 designs:[['rct','RCT'],['nonrandom','非随机对照'],['cohort','队列研究'],['caseControl','病例对照研究'],['crossSectional','横断面研究'],['realWorld','真实世界研究'],['other','其他']],
 people:[['adult','成人'],['child','儿童与青少年'],['older','老年人']],
 methods:[['acupuncture','针灸'],['needling','针刺'],['electroacupuncture','电针'],['moxibustion','艾灸'],['auricular','耳穴']],
 diseases:[['depression','抑郁障碍'],['anxiety','焦虑障碍'],['other','其他情志病']],
 languages:[['en','英文'],['zh','中文'],['other','其他语言']],
};
export const YEAR_CHOICES=[['any','不限'],['1','近 1 年'],['3','近 3 年'],['5','近 5 年'],['custom','自定义范围']];
export const FULLTEXT_CHOICES=[['any','不限'],['readable','当前正文可读'],['unavailable','暂无获准正文']];
export const facetChoices=key=>[...PUBLICATION_FACETS[key],['unknown','未识别']];
const invalid=()=>{throw Object.assign(Error('筛选条件无效，请核对选项和日期范围'),{status:400,code:'HUB_PUBLICATION_FILTER_INVALID'});};
export function validDate(value){try{return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number(value.slice(0,4))>=1800&&Number(value.slice(0,4))<=2200&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}catch{return false;}}
export function normalizePublicationFilters(input={}){
 if(typeof input==='string'){if(input.length>3000)invalid();try{input=JSON.parse(input);}catch{invalid();}}
 if(!input||Array.isArray(input)||typeof input!=='object'||Object.keys(input).some(k=>!['year','from','to','fulltext',...Object.keys(PUBLICATION_FACETS)].includes(k)))invalid();
 if(Object.values(input).some(v=>v===null))invalid();
 const result={year:input.year??'any',from:input.from??'',to:input.to??'',fulltext:input.fulltext??'any'};
 if(!YEAR_CHOICES.some(([v])=>v===result.year)||!FULLTEXT_CHOICES.some(([v])=>v===result.fulltext))invalid();
 for(const key of ['from','to'])if(typeof result[key]!=='string'||(result[key]&&!validDate(result[key])))invalid();
 if(result.from&&result.to&&result.from>result.to)invalid();
 if(result.year!=='custom'){result.from='';result.to='';}
 else if(!result.from&&!result.to)invalid();
 for(const key of Object.keys(PUBLICATION_FACETS)){
  const values=input[key]??[];
  if(!Array.isArray(values)||values.length>facetChoices(key).length||values.some(v=>typeof v!=='string'||!facetChoices(key).some(([id])=>id===v)))invalid();
  result[key]=[...new Set(values)].sort();
 }
 return result;
}
export function publicationDateBounds(date,year){
 const value=typeof date==='string'&&/^\d{4}(?:-\d{2})?(?:-\d{2})?$/.test(date)?date:/^\d{4}$/.test(String(year))?String(year):null;
 if(!value)return null;
 const y=Number(value.slice(0,4));if(y<1800||y>2200)return null;
 if(value.length===4)return [value+'-01-01',value+'-12-31'];
 if(value.length===7){const m=Number(value.slice(5));if(m<1||m>12)return null;return [value+'-01',value+'-'+new Date(Date.UTC(y,m,0)).getUTCDate()];}
 return validDate(value)?[value,value]:null;
}
export function matchesPublicationFilters(item,filters,year=new Date().getUTCFullYear(),except=null){
 const values=item.classification?.values??{};
 for(const key of Object.keys(PUBLICATION_FACETS)){
  if(key===except||!filters[key]?.length)continue;
  const actual=values[key]??[];
  if(!filters[key].some(v=>v==='unknown'?!actual.length:actual.includes(v)))return false;
 }
 if(except!=='fulltext'&&filters.fulltext!=='any'&&Boolean(item.body?.trim())!==(filters.fulltext==='readable'))return false;
 if(except==='year'||filters.year==='any')return true;
 const bounds=publicationDateBounds(item.classification?.publicationDate,item.year);if(!bounds)return false;
 const from=filters.year==='custom'?filters.from:String(year-Number(filters.year)+1)+'-01-01';
 const to=filters.year==='custom'?filters.to:String(year)+'-12-31';
 return (!from||bounds[0]>=from)&&(!to||bounds[1]<=to);
}
export function publicationFacets(items,filters,year=new Date().getUTCFullYear()){
 const result={};
 for(const key of Object.keys(PUBLICATION_FACETS))result[key]=Object.fromEntries(facetChoices(key).map(([value])=>[value,items.filter(item=>matchesPublicationFilters(item,filters,year,key)&&matchesPublicationFilters(item,{...normalizePublicationFilters(),[key]:[value]},year)).length]));
 result.year=Object.fromEntries(YEAR_CHOICES.filter(([v])=>v!=='custom').map(([v])=>[v,items.filter(item=>matchesPublicationFilters(item,filters,year,'year')&&matchesPublicationFilters(item,{...normalizePublicationFilters(),year:v},year)).length]));
 result.fulltext=Object.fromEntries(FULLTEXT_CHOICES.map(([v])=>[v,items.filter(item=>matchesPublicationFilters(item,filters,year,'fulltext')&&matchesPublicationFilters(item,{...normalizePublicationFilters(),fulltext:v},year)).length]));
 return result;
}
export function appliedFilterChips(filters){
 const chips=[];for(const key of Object.keys(PUBLICATION_FACETS))for(const value of filters[key]??[])chips.push({key,value,label:facetChoices(key).find(([v])=>v===value)[1]});
 if(filters.year!=='any')chips.push({key:'year',value:filters.year,label:filters.year==='custom'?`${filters.from||'不限'} 至 ${filters.to||'不限'}`:YEAR_CHOICES.find(([v])=>v===filters.year)[1]});
 if(filters.fulltext!=='any')chips.push({key:'fulltext',value:filters.fulltext,label:FULLTEXT_CHOICES.find(([v])=>v===filters.fulltext)[1]});
 return chips;
}
