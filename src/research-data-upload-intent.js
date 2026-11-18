const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const fail=()=>{throw Error('上传归属或批次无法核对，请先核对原操作，不要重复上传。');};
const refs=files=>{if(!Array.isArray(files)||!files.length||files.length>20||files.some(f=>!id(f.id)||!Number.isSafeInteger(f.version)||f.version<1)||new Set(files.map(f=>f.id)).size!==files.length)fail();return files.map(({id,version})=>({id,version})).sort((a,b)=>a.id.localeCompare(b.id));};
export const requiresStudyUpload=(files,retryIntent)=>Boolean(retryIntent)||files.some(f=>/\.xlsx$/i.test(f.name));
export function selectUploadStudy(targets,{contextStudyId,pinnedStudyId}={}){
 if(!Array.isArray(targets)||targets.some(t=>!id(t.id)||typeof t.name!=='string')||new Set(targets.map(t=>t.id)).size!==targets.length)fail();
 const explicit=pinnedStudyId??contextStudyId;if(explicit)return targets.some(t=>t.id===explicit)?explicit:'';return targets.length===1?targets[0].id:'';
}
export function createUploadStudyIntents({storage,identity,sessionId}){
 if(typeof identity!=='string'||!identity||!id(sessionId))fail();const prefix='rh-upload-study:'+encodeURIComponent(identity)+':'+sessionId+':';
 const read=key=>{let raw;try{raw=storage.getItem(prefix+key);if(!raw)return null;const r=JSON.parse(raw);if(r.schema!=='hub-upload-study.v1'||r.identity!==identity||r.sessionId!==sessionId||!id(r.studyId))fail();return r;}catch{fail();}};
 const write=(key,value)=>{try{storage.setItem(prefix+key,JSON.stringify({schema:'hub-upload-study.v1',identity,sessionId,...value}));}catch{throw Error('无法保存本次上传归属，本次未继续提交。请允许站点存储后重试。');}};
 const forUpload=key=>{if(!id(key))fail();const r=read('upload:'+key);if(r&&r.requestKey!==key)fail();return r;};
 return{
  forUpload,
  beginBatch(keys,studyId,files){if(!Array.isArray(keys)||!keys.length||keys.length>20||keys.some(k=>!id(k))||new Set(keys).size!==keys.length||!id(studyId)||!Array.isArray(files)||files.length!==keys.length)fail();for(let i=0;i<keys.length;i++){const old=forUpload(keys[i]);if(old&&(old.studyId!==studyId||old.groupKeys&&JSON.stringify(old.groupKeys)!==JSON.stringify(keys)))fail();const f=files[i];if(typeof f?.name!=='string'||!f.name||!Number.isSafeInteger(f.size)||f.size<=0)fail();}for(let i=0;i<keys.length;i++)write('upload:'+keys[i],{...forUpload(keys[i]),requestKey:keys[i],studyId,groupKeys:[...keys],expectedFile:{name:files[i].name,size:files[i].size}});},
  assertFile(key,file){const old=forUpload(key);if(!old||old.expectedFile&&(old.expectedFile.name!==file.name||old.expectedFile.size!==file.size))fail();},
  readyBatch(key){const first=forUpload(key);if(!first)return null;const keys=first.groupKeys??[key],entries=keys.map(forUpload);if(entries.some(e=>!e?.file))return null;if(entries.some(e=>e.studyId!==first.studyId))fail();return{keys,files:entries.map(e=>e.file)};},
  begin(key,studyId){if(!id(key)||!id(studyId))fail();const old=forUpload(key);if(old&&old.studyId!==studyId)fail();if(!old)write('upload:'+key,{requestKey:key,studyId});},
  uploaded(key,file){const old=forUpload(key);if(!old)fail();const [ref]=refs([file]);if(old.file&&JSON.stringify(old.file)!==JSON.stringify(ref))fail();write('upload:'+key,{...old,file:ref});},
  bind(plan,keys){if(!id(plan?.id)||!Number.isSafeInteger(plan.version)||plan.version<1||!Array.isArray(keys)||!keys.length)fail();const entries=keys.map(forUpload);if(entries.some(e=>!e?.file)||new Set(entries.map(e=>e.studyId)).size!==1||JSON.stringify(refs(entries.map(e=>e.file)))!==JSON.stringify(refs(plan.files)))fail();const value={studyId:entries[0].studyId,preflightId:plan.id,preflightVersion:plan.version,files:refs(plan.files),uploadKeys:[...keys]};const old=read('batch:'+plan.id+':'+plan.version);if(old&&JSON.stringify(old.files)!==JSON.stringify(value.files)||old&&old.studyId!==value.studyId)fail();write('batch:'+plan.id+':'+plan.version,value);for(const e of entries)write('upload:'+e.requestKey,{...e,batch:{id:plan.id,version:plan.version}});return value;},
  forBatch(plan){if(!plan)return null;const r=read('batch:'+plan.id+':'+plan.version);if(!r||r.preflightId!==plan.id||r.preflightVersion!==plan.version||JSON.stringify(r.files)!==JSON.stringify(refs(plan.files)))return null;return r;},
 };
}
export function profileAutoPreparation(state){
 if(!state.intent||state.route!=='profile'||!state.checked||state.loading||state.pending||state.item||state.choice||state.error||!state.targets?.some(t=>t.id===state.intent.studyId))return null;
 return state.intent.studyId;
}
