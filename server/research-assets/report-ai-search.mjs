import {assetDigest} from '../../scripts/research-assets-registration-contract.mjs';
import {catalogError} from '../../scripts/research-assets-catalog-contract.mjs';
import {compileHubQuery} from '../hub-sources/search-query-plan.mjs';
import {AGENT_QUESTION_MAX_CHARACTERS} from '../../src/agent-question.js';
const fail=(code='REPORT_AI_FRAGMENT_CHANGED')=>{throw catalogError(code,409,'报告片段无法完整核对，请重新读取或缩小问题范围。');};
const dictionary={version:'report-qa-terms.v1',terms:[
 {id:1,zh:'数据完整性',en:['data completeness','missingness','missing data','缺失数','总数','缺失'],enabled:true},
 {id:2,zh:'使用限制',en:['limitations','use restrictions','限制','仅用于','仅供','不作为','不用于'],enabled:true},
 {id:3,zh:'数据来源',en:['provenance','source','来源'],enabled:true},
 {id:4,zh:'分析方法',en:['analysis method','method','方法'],enabled:true}
]};
const delimiter=line=>/^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
const heading=line=>line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
const unit=line=>/^(?:单位|Unit)\s*[:：]/i.test(line??'');
export function fragmentReport(md,expectedHash){
 if(typeof md!=='string'||!md.trim()||md.length>131072||assetDigest(md)!==expectedHash||md.includes('\r'))fail();
 const lines=md.split('\n'),parts=[],path=[],levels=[];let i=0;
 const unitTable=index=>{if(!unit(lines[index]))return -1;let t=index+1;while(t<lines.length&&!lines[t].trim())t++;return lines[t]?.includes('|')&&delimiter(lines[t+1]??'')?t:-1;};
 const push=(start,end,kind)=>{const text=lines.slice(start,end).join('\n');parts.push({id:'rf-'+String(parts.length+1).padStart(4,'0')+'-'+assetDigest(text).slice(0,12),kind,headingPath:[...path],startLine:start+1,endLine:end,text,quoteHash:assetDigest(text)});};
 while(i<lines.length){
  if(!lines[i].trim()){i++;continue;}
  const h=heading(lines[i]);if(h){while(levels.length&&levels.at(-1)>=h[1].length){levels.pop();path.pop();}levels.push(h[1].length);path.push(h[2]);i++;continue;}
  const fence=lines[i].match(/^\s{0,3}(`{3,}|~{3,})/);if(fence){const start=i++;while(i<lines.length&&!new RegExp('^\\s{0,3}'+fence[1][0]+'{'+fence[1].length+',}\\s*$').test(lines[i]))i++;if(i===lines.length)fail('REPORT_AI_FORMAT_UNSUPPORTED');push(start,++i,'code');continue;}
  // Unit captions are part of the whole table quote, not a detached numeric claim.
  let start=i,table=i;
  if(unitTable(i)>=0)table=unitTable(i);
  if(lines[table]?.includes('|')&&delimiter(lines[table+1]??'')){
   i=table+2;while(i<lines.length&&lines[i].trim()&&lines[i].includes('|'))i++;if(i===table+2)fail('REPORT_AI_FORMAT_UNSUPPORTED');let after=i;while(after<lines.length&&!lines[after].trim())after++;if(unit(lines[after])&&unitTable(after)<0)i=after+1;push(start,i,'table');continue;
  }
  i++;while(i<lines.length&&lines[i].trim()&&!heading(lines[i])&&!/^\s{0,3}(?:`{3,}|~{3,})/.test(lines[i])&&unitTable(i)<0&&!(lines[i].includes('|')&&delimiter(lines[i+1]??'')))i++;
  push(start,i,'paragraph');
 }
 if(!parts.length||parts.length>512)fail('REPORT_AI_FORMAT_UNSUPPORTED');return parts;
}
export function assertReportFragmentsCurrent(expected,current){if(assetDigest(expected)!==assetDigest(current))fail();return true;}
export function searchReportFragments(question,parts,{seedAsset=false,maxFragments=8,maxCharacters=12000}={}){
 if(typeof question!=='string'||[...question.trim()].length<2||[...question.trim()].length>AGENT_QUESTION_MAX_CHARACTERS||!Array.isArray(parts)||!parts.length||!Number.isSafeInteger(maxFragments)||maxFragments<1||maxFragments>8||!Number.isSafeInteger(maxCharacters)||maxCharacters<1||maxCharacters>12000)fail('REPORT_AI_QUERY_INVALID');
 if(parts.some(p=>!p?.id||typeof p.text!=='string'||assetDigest(p.text)!==p.quoteHash))fail();
 const normalized=question.trim().normalize('NFKC'),cleaned=normalized.replace(/请概括|请说明|请解释|概括|说明|解释|这份报告|本报告|报告中|并引用原文|引用原文|[,，。？?]/gu,'').replace(/^报告的/u,'').replace(/是什么$/u,'').trim();
 const fixed=seedAsset&&/^(?:请)?(?:概括|说明|解释)?(?:这份报告|本报告)[。？?]?$/u.test(normalized),plan=cleaned?compileHubQuery(cleaned,dictionary,{maxCharacters:AGENT_QUESTION_MAX_CHARACTERS}):null;
 let selected=[];
 if(fixed)selected=parts;
 else if(plan){
  const groups=plan.mode==='mapped'?plan.conceptGroups.map(g=>g.terms):[plan.appliedTerms],texts=parts.map(p=>(p.headingPath.join(' / ')+'\n'+p.text).toLocaleLowerCase());
  if(groups.every(group=>texts.some(t=>group.some(term=>t.includes(term.toLocaleLowerCase())))))selected=parts.filter((_p,i)=>groups.some(group=>group.some(term=>texts[i].includes(term.toLocaleLowerCase()))));
 }
 // Do not silently take the first N fragments or slice a table mid-row.
 if(selected.length>maxFragments||selected.reduce((n,p)=>n+p.text.length,0)>maxCharacters)fail('REPORT_AI_EVIDENCE_CAPACITY');
 return{status:selected.length?'ready':'no_evidence',toolName:fixed?'asset_fixed_version_read':'asset_version_search',query:question,plan:plan??{mode:'fixed',dictionaryVersion:dictionary.version},evidence:selected};
}
