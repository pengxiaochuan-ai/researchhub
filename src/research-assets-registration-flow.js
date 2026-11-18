import {assetRegistrationDraft,buildAssetRegistrationPayload,createAssetRegistrationAttempt,assertAssetRegistrationOptions,assertAssetEditDraft,assetRegistrationMessage} from './research-assets-registration.js';
const blocked=new Set(['loading','submitting','uploading','unknown','upload_unknown','retryable','invalid','committed']);
const conflict=message=>{throw Object.assign(new Error(message),{status:409});};
const sameTarget=(a,b)=>a?.assetId===b?.assetId&&a?.version===b?.version;
export function createAssetRegistrationFlow({user,scope,api,storage,onChange=()=>{},onCommitted=()=>{},makeKey=()=>crypto.randomUUID()}){
 let s={open:false,phase:'idle',dirty:false,draft:null,options:null,file:null},epoch=0,baseline='',target,attempt=createAssetRegistrationAttempt({makeKey}),uploadKey;
 const update=values=>{s={...s,...values};onChange(s);return s;};
 const editable=()=>{if(blocked.has(s.phase)||!s.draft)conflict('请先核对当前保存结果或重新读取。');};
 const draftChanged=draft=>update({draft,dirty:JSON.stringify(draft)!==baseline||Boolean(s.file),message:'',fields:{},phase:'editing'});
 const context={tenantId:user.tenantId,accountId:user.accountId,authVersion:user.authVersion,...scope},pendingKey='rh-asset-registration-pending:'+JSON.stringify(Object.values(context));
 const clearPending=()=>{try{storage?.removeItem(pendingKey);}catch{/* A leftover marker can only recheck the same committed operation. */}};
 const remember=()=>{if(!storage)return;const a=attempt.state(),marker=JSON.stringify({context,requestKey:a.payload.requestKey,assetId:a.assetId,expectedVersion:a.expectedVersion,expectedRevision:a.expectedRevision});storage.setItem(pendingKey,marker);if(storage.getItem(pendingKey)!==marker)conflict('无法保留保存核对标识，尚未发送请求。');};
 const complete=receipt=>{clearPending();update({phase:'committed',receipt,dirty:false,message:'已保存为私有草稿；尚未提交审核。'});onCommitted(receipt);};
 return{
  state:()=>s,
  async open(nextTarget){
   if(s.phase==='invalid')return;
   if(!nextTarget&&s.dirty&&s.draft){update({open:true,message:['unknown','upload_unknown'].includes(s.phase)?'上次操作结果尚未确认，请先核对；原输入已保留。':'已恢复未保存输入，请先保存或放弃。'});return;}
   if(s.dirty&&!sameTarget(target,nextTarget))conflict('尚有未保存输入，请先保存或放弃当前草稿。');
   if(s.draft&&sameTarget(target,nextTarget)){update({open:true});return;}
   if(!s.draft&&storage){try{const raw=storage.getItem(pendingKey);if(raw){const marker=JSON.parse(raw);if(JSON.stringify(marker.context)!==JSON.stringify(context))conflict('原保存身份无法核对。');attempt.restore(marker);update({open:true,phase:'unknown',dirty:false,message:'上次保存结果尚待核对；正文和文件未存入浏览器。'});return;}}catch(e){update({open:true,phase:'error',message:'原保存标识无法读取，请先核对资产目录，不要重复登记。'});return;}}
   target=nextTarget;const token=++epoch;update({open:true,phase:'loading',message:'',options:null});
   try{
    const options=assertAssetRegistrationOptions(await api.get('/research-assets/registrable-sources'+(target?'?assetId='+encodeURIComponent(target.assetId):'')),{scope,user});if(token!==epoch)return;
    if(!target&&options.admission?.canCreate===false){update({phase:'capacity',options,draft:null,file:null,dirty:false,message:options.admission.reason});return;}
    if(!target&&options.family!=='business'&&options.ownAssets.length>=5){update({phase:'capacity',options,draft:null,file:null,dirty:false,message:'当前无法继续新增资产；请从已有资产详情选择“修订内容”。'});return;}
    const edit=target?assertAssetEditDraft(await api.get('/research-assets/'+target.assetId+'/registration?version='+target.version),{scope,...target,identityRevision:options.identityRevision}):null;if(token!==epoch)return;
    const draft=assetRegistrationDraft(user,edit);if(!edit){if(options.uploadsStatus!=='ready')draft.mode='manual';if(options.family!=='business'){const available=['protocol','dataset','instrument','analysis','publication'].find(k=>!options.ownAssets.some(a=>a.kind===k));if(available)draft.kind=available;}}
    baseline=JSON.stringify(draft);attempt=createAssetRegistrationAttempt({makeKey});uploadKey=undefined;
    update({phase:'editing',options,edit,draft,file:null,dirty:false,receipt:null,fields:{}});
   }catch(e){if(token===epoch)update({phase:'error',message:assetRegistrationMessage(e),options:null});}
  },
  close(){if(['submitting','uploading','loading'].includes(s.phase))return;if(['committed','absent','capacity'].includes(s.phase)){epoch++;baseline='';target=undefined;uploadKey=undefined;update({open:false,phase:'idle',dirty:false,draft:null,options:null,file:null,edit:null,receipt:null,message:'',fields:{}});}else update({open:false});},
  discard(){if(['submitting','uploading','unknown','upload_unknown'].includes(s.phase))return;clearPending();epoch++;baseline='';target=undefined;attempt=createAssetRegistrationAttempt({makeKey});uploadKey=undefined;update({open:false,phase:'idle',dirty:false,draft:null,options:null,file:null,edit:null,receipt:null,message:'',fields:{}});},
  pause(){epoch++;if(s.phase==='submitting')attempt.failed({status:503});update({phase:s.phase==='submitting'?'unknown':s.phase==='uploading'?'upload_unknown':s.phase==='loading'?'error':s.phase,message:'当前读取暂不可用，输入已保留；请重新读取后核对原操作。'});},
  invalidate(){epoch++;baseline='';uploadKey=undefined;update({open:false,phase:'invalid',dirty:false,draft:null,options:null,file:null,edit:null,receipt:null,message:'账号或会话权限已变化，请重新读取资产。'});},
  change(values){editable();draftChanged({...s.draft,...values,metadata:{...s.draft.metadata,...values.metadata}});},
  selectSource(id){editable();const source=s.options.sources.find(x=>x.id===id);if(!source)conflict('来源当前不可用，请重新读取。');draftChanged({...s.draft,mode:'knowledge',sourceId:id,contentMd:source.contentMd,rightsEvidence:source.rightsEvidence,metadata:{...s.draft.metadata,title:s.draft.metadata.title||source.title}});},
  selectFile(file){
   editable();if(!file||!file.size||file.size>5242880||!/\.(txt|md)$/i.test(file.name))throw Object.assign(new Error('请选择非空TXT或Markdown文件，最多5MiB。'),{status:422});
   uploadKey=makeKey();update({file});draftChanged({...s.draft,mode:'file',uploadId:null});
  },
  async save(){
   if(!s.options||!s.draft||['loading','submitting','uploading','unknown','invalid','committed'].includes(s.phase))return;
   const token=epoch;let started=false;
   try{
    let payload;
    if(s.phase==='retryable'){payload=attempt.retry();started=true;}
    else{
     // Validate all fields before spending a staging slot. A selected file gets only a temporary validator token.
     buildAssetRegistrationPayload({...s.draft,uploadId:s.draft.uploadId??(s.file?'selected-file':null)},{user,options:s.options,edit:s.edit});
     if(s.draft.mode==='file'&&!s.draft.uploadId){
      if(!s.file)throw Object.assign(new Error('请选择文件。'),{status:422});
      update({phase:'uploading',message:'正在暂存文件…'});const selectedFile=s.file,digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await selectedFile.arrayBuffer())),x=>x.toString(16).padStart(2,'0')).join('');if(token!==epoch)return;
      const form=new FormData();form.append('file',selectedFile);form.append('requestKey',uploadKey);
      let uploaded;try{uploaded=await api.upload('/research-assets/uploads',form);}catch(e){if(token===epoch)update({phase:!e.status||e.status>=500?'upload_unknown':'editing',message:!e.status||e.status>=500?'文件暂存结果未确认；文件和输入已保留，请用原文件核对重试。':assetRegistrationMessage(e)});return;}
      if(token!==epoch)return;
      if(!uploaded||!/^[A-Za-z0-9_-]{1,160}$/.test(uploaded.uploadId??'')||uploaded.filename!=='asset_'+digest.slice(0,16)+'.'+selectedFile.name.split('.').at(-1).toLowerCase()||uploaded.sizeBytes!==selectedFile.size||uploaded.sha256!==digest||uploaded.status!=='pending'){update({phase:'upload_unknown',message:'文件暂存结果无法核对；文件和输入已保留，请用原文件核对重试。'});return;}
      update({draft:{...s.draft,uploadId:uploaded.uploadId},phase:'editing'});
     }
     payload=attempt.begin(buildAssetRegistrationPayload(s.draft,{user,options:s.options,edit:s.edit}),{assetId:target?.assetId});started=true;
    }
    update({phase:'submitting',message:'正在保存草稿…',fields:{}});
    remember();
    const receipt=await api.post(target?'/research-assets/'+target.assetId+'/versions':'/research-assets',payload);if(token!==epoch)return;attempt.accept(receipt);complete(receipt);
   }catch(e){if(token!==epoch)return;const fileNeedsReconcile=started&&s.draft.mode==='file';if(started)attempt.failed(fileNeedsReconcile?{status:0}:e);if(started&&attempt.state().phase==='rejected')clearPending();update({phase:started?attempt.state().phase:'editing',message:fileNeedsReconcile?'文件登记结果尚未确认；输入已保留，请先核对原保存结果。':assetRegistrationMessage(e),fields:e.fields??{}});}
  },
  async lookup(){
   if(s.phase!=='unknown')return;const token=epoch,key=attempt.state().payload?.requestKey;update({message:'正在核对原保存结果…'});
   try{const receipt=await api.get('/research-assets/operations/'+key);if(token!==epoch)return;attempt.lookup(receipt);if(receipt.status==='committed')complete(receipt);else if(attempt.state().phase==='absent'){clearPending();update({phase:'absent',message:'未找到原保存记录，浏览器未保留原输入。请关闭后核对目录，再重新登记。'});}else update({phase:'retryable',message:'未找到原保存记录；可以使用原内容重试，不会创建另一份。'});}
   catch(e){if(token===epoch)update({phase:'unknown',message:assetRegistrationMessage(e)});}
  }
 };
}
