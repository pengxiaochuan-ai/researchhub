import React,{useEffect,useRef,useState} from 'react';
import ConfirmDialog from './ConfirmDialog.jsx';
import {Button} from './Components.jsx';
import './research-assets-registration.css';
const kindLabels={protocol:'研究方案',dataset:'数据集',instrument:'量表工具',analysis:'分析方法',publication:'学术成果'};
const frozen=new Set(['loading','submitting','uploading','unknown','upload_unknown','retryable','committed','invalid']);
export default function ResearchAssetRegistrationDialog({model:m,onChange,onSource,onFile,onSave,onLookup,onClose,onDiscard,returnFocus,unavailable=false,scopeChoices,selectedScope,onScopeChange}){
 const form=useRef(null),[discard,setDiscard]=useState(false),[fileError,setFileError]=useState('');
 useEffect(()=>{const key=Object.keys(m.fields??{})[0];if(key)form.current?.querySelector('[name="'+key+'"]')?.focus();},[m.fields]);
 if(!m.open)return null;
 if(discard)return <ConfirmDialog title="放弃未保存输入？" confirmLabel="放弃输入" onCancel={()=>setDiscard(false)} onConfirm={()=>{setDiscard(false);onDiscard();}}><p>尚未保存的文字与文件选择将清空；已暂存的文件及既有资产不会删除。</p></ConfirmDialog>;
 const busy=['loading','submitting','uploading'].includes(m.phase),locked=frozen.has(m.phase),done=['committed','absent','capacity'].includes(m.phase),unknown=m.phase==='unknown',d=m.draft;
 const primary=m.phase==='choose-study'?'继续登记':m.phase==='capacity'?'返回资产':done?'完成':unknown?'核对保存结果':m.phase==='retryable'?'原内容重试':m.phase==='upload_unknown'?'核对暂存并保存':m.edit?'保存新版本':'保存草稿';
 function field(key,label,max,{multiline=false,optional=false}={}){
  const props={id:'asset-registration-'+key,name:key,value:d.metadata[key]??'',maxLength:max,required:!optional,'aria-invalid':Boolean(m.fields?.[key]),'aria-describedby':m.fields?.[key]?'asset-registration-'+key+'-error':undefined,onChange:e=>onChange({metadata:{[key]:e.target.value}})};
  return <label>{label}{!optional?' *':''}{multiline?<textarea {...props} rows={3}/>:<input {...props}/>}<ErrorField name={key} errors={m.fields}/></label>;
 }
 function fileChanged(e){try{onFile(e.target.files[0]);setFileError('');}catch(error){setFileError(error.message);}e.target.value='';}
 return <ConfirmDialog title={m.edit?'修订资产':'登记资产'} returnFocus={returnFocus} danger={false} busy={busy} cancelLabel={done?'关闭':'关闭，保留输入'} confirmLabel={primary} confirmDisabled={m.phase==='choose-study'&&!selectedScope||m.phase==='error'||m.phase==='invalid'||unavailable&&!done} onCancel={onClose} onConfirm={done?onClose:unknown?onLookup:onSave}>
  <div className="asset-registration-form" ref={form}>
   {scopeChoices&&<label>归属研究<select aria-label="归属研究" value={selectedScope?selectedScope.studyGroupId+':'+selectedScope.researchProjectId:''} disabled={Boolean(m.edit)||locked||done} onChange={e=>onScopeChange?.(scopeChoices.find(s=>s.studyGroupId+':'+s.researchProjectId===e.target.value)??null)}><option value="">请选择归属研究</option>{scopeChoices.map(s=><option key={s.studyGroupId+':'+s.researchProjectId} value={s.studyGroupId+':'+s.researchProjectId}>{s.label}</option>)}</select></label>}
   {unavailable&&<p role="alert">当前资产状态未核对，暂不能保存；原输入已保留。</p>}
   {m.message&&<p role={['committed','loading','uploading','submitting','retryable'].includes(m.phase)?'status':'alert'}>{m.message}</p>}
   {!unavailable&&d&&m.options&&<fieldset disabled={locked}>
    <div className="asset-registration-fields">
     <label>资产类型<select name="kind" value={d.kind} disabled={Boolean(m.edit)} onChange={e=>onChange({kind:e.target.value})}>{Object.entries(kindLabels).map(([value,label])=><option key={value} value={value} disabled={!m.edit&&m.options.family!=='business'&&m.options.ownAssets.some(a=>a.kind===value)}>{label}</option>)}</select><ErrorField name="kind" errors={m.fields}/></label>
     <label>研究领域（选填）<input name="domains" value={d.domains} onChange={e=>onChange({domains:e.target.value})} placeholder="如针灸、情志病；以逗号分隔"/><ErrorField name="domains" errors={m.fields}/></label>
    </div>
    {field('title','题名',160)}
    {field('summary','摘要',2000,{multiline:true})}
    <div className="asset-registration-fields">{field('purpose','用途',2000,{multiline:true})}{field('limitations','适用限制',2000,{multiline:true})}</div>
    {field('author','作者',240)}
    <label>内容来源<select name="sourceId" value={d.mode} onChange={e=>onChange({mode:e.target.value})}><option value="file" disabled={m.options.uploadsStatus!=='ready'}>TXT／Markdown文件</option><option value="knowledge" disabled={m.options.sourcesStatus!=='ready'}>已审核资料</option><option value="manual">手工整理</option></select></label>
    {d.mode==='file'?<div className="asset-registration-file">
     <label>选择文件 *<input name="uploadId" type="file" accept=".txt,.md,text/plain,text/markdown" onChange={fileChanged} aria-invalid={Boolean(fileError||m.fields?.uploadId)} aria-describedby="asset-registration-file-help"/></label>
     <p id="asset-registration-file-help">仅TXT或Markdown，最多5MiB。{m.edit?.fileRevisionRequiresNewUpload?'修订需重新选择文件；原版附件保持不变。':''}</p>
     {m.file&&<p role="status">已选择：{m.file.name}</p>}{fileError&&<p role="alert">{fileError}</p>}<ErrorField name="uploadId" errors={m.fields}/>
     {!m.file&&m.options.pendingUploads.filter(x=>x.status==='pending').length>0&&<label>或使用本人未登记文件<select value={d.uploadId??''} onChange={e=>onChange({uploadId:e.target.value||null})}><option value="">请选择</option>{m.options.pendingUploads.filter(x=>x.status==='pending').map(x=><option key={x.uploadId} value={x.uploadId}>{x.filename}</option>)}</select></label>}
    </div>:<>
     {d.mode==='knowledge'&&<div className="asset-registration-sources"><p>选择已审核且允许整理为资产的资料：</p>{m.options.sources.length?m.options.sources.map(source=><Button key={source.id} primary={d.sourceId===source.id} onClick={()=>onSource(source.id)}>{source.title}</Button>):<p>暂无可用来源，请使用原创材料或联系资料管理员。</p>}<ErrorField name="sourceId" errors={m.fields}/></div>}
     <label>正文 *<textarea className="asset-registration-reading" name="contentMd" value={d.contentMd} onChange={e=>onChange({contentMd:e.target.value})} rows={8} aria-invalid={Boolean(m.fields?.contentMd)} aria-describedby={m.fields?.contentMd?'asset-registration-contentMd-error':undefined}/><ErrorField name="contentMd" errors={m.fields}/></label>
    </>}
    {d.kind==='analysis'&&<p>此处保存方法说明，不代表已执行结果。</p>}
    <label>来源与用途依据<textarea name="rightsEvidence" value={d.rightsEvidence} maxLength={4000} onChange={e=>onChange({rightsEvidence:e.target.value})} rows={3}/><ErrorField name="rightsEvidence" errors={m.fields}/></label>
    <p>未填写依据时只能保存草稿，不能提交审核。</p>
    <label>审核后允许发现摘要的人<select name="audience" value={d.audience} onChange={e=>onChange({audience:e.target.value})}><option value="private">仅本人</option>{m.options.actors.filter(a=>!a.isSelf).map(a=><option key={a.accountId} value="named">本人及{a.displayName}</option>)}</select><ErrorField name="audience" errors={m.fields}/></label>
    <p>现在仅保存私有草稿；发现摘要不等于获得正文或引用许可。</p>
   </fieldset>}
   {m.dirty&&!busy&&!['unknown','upload_unknown','invalid'].includes(m.phase)&&<Button danger onClick={()=>setDiscard(true)}>放弃输入</Button>}
  </div>
 </ConfirmDialog>;
}
function ErrorField({name,errors}){return errors?.[name]?<span id={'asset-registration-'+name+'-error'} className="asset-registration-error" role="alert">{errors[name]}</span>:null;}
