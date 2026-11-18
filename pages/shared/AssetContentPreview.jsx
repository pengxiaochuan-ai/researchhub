import './report-asset-qa.css';
import React,{useEffect,useRef,useState} from 'react';
import {readReportQaCitation,reportQaPath,reportQaHref} from '../../src/report-asset-qa.js';
import {Card} from './Components.jsx';
import Markdown from '../../src/knowledge-reuse/components/Markdown';
import {RESEARCH_ASSET_LABELS} from '../../src/research-assets-session.js';
import {reportsUrl} from '../../src/formal-reports-session.js';
const sourceNames={author:'作者手工整理',knowledge:'知识资料固定版本',artifact:'已有科研产物固定版本',upload:'上传文件'};

export default function AssetContentPreview({asset,api,scope}){
 const host=useRef(null),allowed=asset.bodyAccess==='allowed';
 const[quote,setQuote]=useState(null),[quoteError,setQuoteError]=useState(''),[hash,setHash]=useState(()=>globalThis.location?.hash??''),apiRef=useRef(api);apiRef.current=api;
 useEffect(()=>{const update=()=>setHash(location.hash);window.addEventListener('hashchange',update);return()=>window.removeEventListener('hashchange',update);},[]);
 useEffect(()=>{let active=true;setQuote(null);setQuoteError('');const c=readReportQaCitation(hash);if(!c)return;if(c.invalid||!asset.reportQaEligible||!allowed){setQuoteError('引用位置无法核对，请重新检索报告。');return;}apiRef.current.post(reportQaPath(asset.id,asset.version,'/fragment'),{fragmentId:c.id,quoteHash:c.quoteHash,startLine:c.startLine,endLine:c.endLine}).then(f=>{if(!active)return;if(f.text!==asset.contentMd.split('\n').slice(f.startLine-1,f.endLine).join('\n'))throw Error('报告引用与当前固定版不一致。');setQuote(f);}).catch(e=>{if(active)setQuoteError(e.message);});return()=>{active=false;};},[asset.id,asset.version,asset.contentMd,asset.reportQaEligible,allowed,hash]);
 useEffect(()=>{if(quote){const node=host.current?.querySelector('.report-qa-quote');node?.focus();node?.scrollIntoView({block:'center'});}},[quote]);
 useEffect(()=>{
  // The shared Markdown already owns each table's scroll wrapper; add local keyboard access without changing that renderer.
  host.current?.querySelectorAll('.research-asset-reading table').forEach((table,index)=>{
   const wrapper=table.parentElement;wrapper.tabIndex=0;wrapper.setAttribute('role','region');wrapper.setAttribute('aria-label','资产表格'+(index+1));
  });
 },[asset.contentMd,allowed,quote]);
 return <div ref={host} className="asset-preview-container">
  <div className="asset-preview-context form-block">
   {hash.includes('reportQa=1')&&<p><a href={reportQaHref(scope,asset.id,asset.version)}>返回报告问答</a>{quote?' · 已核对原文第'+quote.startLine+'–'+quote.endLine+'行':quoteError?' · '+quoteError:' · 正在核对引用位置…'}</p>}
   {asset.sourceOrigin&&<p><a href={reportsUrl(asset.sourceOrigin.studyId,{artifactId:asset.sourceOrigin.reportId})}>查看原方法报告 · 第{asset.sourceOrigin.reportVersion}版</a></p>}
   <dl className="asset-preview-use-conditions">{[['用途',asset.metadata.purpose??'未提供'],['适用限制',asset.metadata.limitations??'未提供']].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
  </div>
  <div className="asset-preview">
   <div className="research-asset-reading" aria-label="资产正文">{allowed?quote?<><Markdown allowImages={false} headingOffset={2}>{asset.contentMd.split('\n').slice(0,quote.startLine-1).join('\n')}</Markdown><section tabIndex={-1} className="report-qa-quote" aria-label="已核对的固定版引用"><Markdown allowImages={false} headingOffset={2}>{quote.text}</Markdown></section><Markdown allowImages={false} headingOffset={2}>{asset.contentMd.split('\n').slice(quote.endLine).join('\n')}</Markdown></>:<Markdown allowImages={false} headingOffset={2}>{asset.contentMd}</Markdown>:<p>当前仅获准查看摘要。可通过本页“申请使用”申请本固定版本的正文使用许可。</p>}</div>
   <div className="stack"><Card title="核心信息"><div className="detail-list form-block">{[['资产类型',RESEARCH_ASSET_LABELS[asset.kind]],['材料来源',sourceNames[asset.sourceKind]??'待核对']].map(([label,value])=><p key={label}><span>{label}</span><b>{value}</b></p>)}</div></Card><Card title="摘要"><p className="form-block">{asset.metadata.summary}</p></Card></div>
  </div>
 </div>;
}
