import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),esbuild=createRequire(require.resolve('vite/package.json'))('esbuild');
async function compile(name,mocks={}){
 const b=await esbuild.build({entryPoints:[new URL('../pages/shared/'+name,import.meta.url).pathname],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',loader:{'.css':'empty'},plugins:[{name:'test-boundaries',setup(build){build.onResolve({filter:/.*/},a=>{const k=Object.keys(mocks).find(k=>a.path.endsWith(k));return k?{path:k,namespace:'boundary'}:undefined;});build.onLoad({filter:/.*/,namespace:'boundary'},a=>({contents:mocks[a.path]}));}}]});return b.outputFiles[0].text;
}
const mediaBundle=await compile('AgentMedia.jsx',{'Components.jsx':"export const Button='button';",'AgentMediaIngest.jsx':"export const AgentMediaIngest='Registration';",'AgentMediaContent.jsx':"export const AgentMediaContent='VideoContent';"});
const ingestBundle=await compile('AgentMediaIngest.jsx',{'Components.jsx':"export const Button='button';"});
const fileBundle=await compile('CaptureFiles.jsx',{'Components.jsx':"export const Button='button';",'AgentMediaIngest.jsx':"export const RegisteredMediaList='RegisteredMediaList';",'research-projects-session.js':'export const createResearchProjectsClient=()=>({});','platform-user.js':"export const getPlatformUser=()=>({id:'actor'});",'ConfirmDialog.jsx':"export default 'ConfirmDialog';"});
function render(bundle,exportName,props){
 let slots=[],cursor=0,effects=[],changed=true,result;const listeners=new Map();
 const previous=new Map(['window','document','location'].map(k=>[k,globalThis[k]]));
 globalThis.location={pathname:'/pages/s09/',search:'?formalCapture=1&studyId=study&visitId=visit',hash:''};globalThis.document={activeElement:null,visibilityState:'visible',addEventListener:(n,f)=>{const a=listeners.get(n)||new Set();a.add(f);listeners.set(n,a);},removeEventListener:(n,f)=>listeners.get(n)?.delete(f)};globalThis.window={addEventListener:document.addEventListener,removeEventListener:document.removeEventListener};
 const React={createElement:(type,props,...children)=>{if(props?.ref)props.ref.current={focus(){},scrollIntoView(){},open:false};return{type,props:{...props,children}};},useRef(v){const i=cursor++;return slots[i]??(slots[i]={current:v});},useState(v){const i=cursor++;if(!(i in slots))slots[i]=typeof v==='function'?v():v;return[slots[i],n=>{slots[i]=typeof n==='function'?n(slots[i]):n;changed=true;}];},useEffect(fn,deps){const i=cursor++,old=slots[i];if(!old||!deps||deps.some((v,n)=>!Object.is(v,old.deps?.[n])))effects.push(()=>{old?.cleanup?.();slots[i]={deps,cleanup:fn()};});}};
 const m={exports:{}};new Function('require','module','exports',bundle)(n=>n==='react'?React:require(n),m,m.exports);
 const text=n=>n==null?'':Array.isArray(n)?n.map(text).join(''):typeof n==='object'?text(n.props?.children):String(n),walk=n=>n==null?[]:Array.isArray(n)?n.flatMap(walk):typeof n==='object'?[n,...walk(n.props?.children)]:[];
 function run(){for(let i=0;changed&&i<15;i++){changed=false;cursor=0;effects=[];result=m.exports[exportName](props);for(const e of effects)e();}}
 run();return{get value(){return result;},get text(){return text(result);},get nodes(){return walk(result);},update(patch){props={...props,...patch};changed=true;run();},click(pattern){const button=walk(result).find(n=>n.type==='button'&&pattern.test(text(n)));assert(button,'button missing: '+pattern);button.props.onClick();run();},focus(){for(const f of listeners.get('focus')??[])f();run();},async flush(){for(let i=0;i<12;i++){run();await new Promise(r=>setImmediate(r));}},dispose(){for(const s of slots)s?.cleanup?.();for(const[k,v]of previous)if(v===undefined)delete globalThis[k];else globalThis[k]=v;}};
}
const image=()=>({id:'image',modality:'tongue',name:'tongue.png',version:3,extension:'png',byteSize:120,archiveState:'archived',inspectionState:'complete',classification:'valid',contentUnderstood:false,createdAt:'2026-11-19T00:00:00.000Z',inspection:{hasVideo:false,hasAudio:false,hasImage:true,width:640,height:480}});
const media=item=>({client:{},identity:'actor',sessionId:'session',enabled:true,registrationEnabled:true,contentEnabled:true,acquisitionContext:{studyId:'study',subjectId:'subject',visitId:'visit'},items:[item],pending:[],resumeInput:{current:null},playbackRef:{current:null},closePlaybackRef:{current:null},onRegistrationDirty(){}});
const receipt=()=>({id:'binding',version:2,state:'committed',requestKey:'original',confirmationHash:'a'.repeat(64),source:{mediaId:'image',modality:'tongue',sha256:'b'.repeat(64),byteSize:120,inspection:image().inspection},study:{id:'study',name:'合成研究'},subject:{id:'subject',subjectCode:'SYNTHETIC'},visit:{id:'visit',name:'本次访视'},collectedAt:null,receipt:{schema:'hub-media-ingest-receipt.v1',modalityFileId:'file',confirmationHash:'a'.repeat(64),registeredAt:'2026-11-19T00:00:00.000Z'},contentHref:'/api/research-studies/study/subjects/subject/session-media-ingests/binding/content'});

test('actual AI image area offers registration with the original context and renders img rather than video understanding',()=>{
 const props=media(image()),h=render(mediaBundle,'AgentMediaView',{media:props});try{
  const registration=h.nodes.find(n=>n.type==='Registration');assert(registration,'readable tongue image must be eligible for the existing registration area');assert.deepEqual(registration.props.acquisitionContext,props.acquisitionContext);
  assert.equal(h.nodes.some(n=>n.type==='VideoContent'),false,'tongue images must never enter video understanding');
  h.click(/查看原图|查看图片|预览原图|预览图片/);const img=h.nodes.find(n=>n.type==='img');assert(img,'image preview required');assert.equal(img.props.src,'/api/sessions/session/media/image/content');assert.equal(h.nodes.some(n=>n.type==='video'),false);assert.doesNotMatch(h.text,/视频可播放|时长.*秒/);
 }finally{h.dispose();}
});
test('the original video still has playback, registration and video understanding',()=>{
 const video={...image(),id:'video',name:'original.mp4',extension:'mp4',inspection:{hasVideo:true,hasAudio:false,durationSeconds:1}};delete video.modality;const h=render(mediaBundle,'AgentMediaView',{media:media(video)});try{assert(h.nodes.some(n=>n.type==='Registration'));assert(h.nodes.some(n=>n.type==='VideoContent'));h.click(/^播放$/);assert(h.nodes.some(n=>n.type==='video'&&n.props.src==='/api/sessions/session/media/video/content'));assert.equal(h.nodes.some(n=>n.type==='img'),false);}finally{h.dispose();}
});
test('AI image loading failure hides the broken image and an explicit retry restores only the protected original',async()=>{
 const writes=[],props=media(image());props.client={get:async()=>({items:[image()],nextCursor:null}),post:async(...a)=>{writes.push(['post',...a]);},upload:async(...a)=>{writes.push(['upload',...a]);}};props.upload=async()=>writes.push(['media-upload']);props.recheck=async()=>writes.push(['recheck']);props.refresh=async()=>{};
 const h=render(mediaBundle,'AgentMediaView',{media:props});try{
  h.click(/查看原图|查看图片|预览原图|预览图片/);const original=h.nodes.find(n=>n.type==='img');assert(original);original.props.onError();await h.flush();assert.equal(h.nodes.some(n=>n.type==='img'),false,'broken image must be removed from the rendered view');assert.match(h.text,/舌图无法加载/);h.click(/重新加载原图/);await h.flush();assert.equal(h.nodes.find(n=>n.type==='img')?.props.src,'/api/sessions/session/media/image/content');assert.doesNotMatch(h.text,/舌图无法加载/);assert.equal(h.nodes.some(n=>n.type==='video'||n.type==='VideoContent'),false);assert.deepEqual(writes,[],'preview retry cannot create uploads, registration or processing');
 }finally{h.dispose();}
});
test('registered image uses the guarded research original and drops an opened image immediately after permission loss',async()=>{
 let denied=false;const client={get:async()=>{if(denied)throw Object.assign(Error('读取权限已变化'),{status:403});return{items:[receipt()],nextCursor:null};}},h=render(ingestBundle,'RegisteredMediaList',{client,identity:'actor',studyId:'study',subjectId:'subject',visitId:'visit',enabled:true});try{
  await h.flush();assert.match(h.text,/舌图原件/);h.click(/查看原图|查看图片|预览原图|预览图片/);assert.equal(h.nodes.find(n=>n.type==='img')?.props.src,receipt().contentHref);assert.equal(h.nodes.some(n=>n.type==='video'),false);
  denied=true;h.focus();await h.flush();assert.match(h.text,/读取权限已变化/);assert.equal(h.nodes.some(n=>n.type==='img'),false);assert.equal(h.nodes.some(n=>n.type==='button'&&/原图|回执/.test(String(n.props.children))),false);
 }finally{h.dispose();}
});
test('a late original-image list cannot return after identity changes or the view becomes unverified',async()=>{
 for(const patch of [{identity:'other',enabled:false},{enabled:false}]){let release;const client={get:()=>new Promise(r=>release=r)},h=render(ingestBundle,'RegisteredMediaList',{client,identity:'actor',studyId:'study',subjectId:'subject',visitId:'visit',enabled:true});try{h.update(patch);release({items:[receipt()],nextCursor:null});await h.flush();assert.equal(h.nodes.some(n=>n.type==='img'),false);assert.equal(h.nodes.length,0);}finally{h.dispose();}}
});
test('image loading failure closes the old image and offers an explicit current-record retry',async()=>{
 const client={get:async()=>({items:[receipt()],nextCursor:null})},h=render(ingestBundle,'RegisteredMediaList',{client,identity:'actor',studyId:'study',subjectId:'subject',visitId:'visit',enabled:true});try{
  await h.flush();h.click(/查看原图|查看图片|预览原图|预览图片/);const img=h.nodes.find(n=>n.type==='img');assert(img);await img.props.onError();await h.flush();assert.equal(h.nodes.some(n=>n.type==='img'),false);assert.match(h.text,/舌图无法加载/);h.click(/重新读取登记记录/);await h.flush();assert.doesNotMatch(h.text,/舌图无法加载/);assert.equal(h.nodes.some(n=>n.type==='img'),false,'re-reading the receipt must not silently restart image loading');
 }finally{h.dispose();}
});
test('original tongue file remains awaiting review with no invented features and can be opened from its visit',()=>{
 const files={studyId:'study',visitId:'visit',capabilities:{canUploadPreprocessed:true,canReadFeatureValues:true},preprocessedUploadStatus:'available',unassignedFeatureCount:0,nextCursor:null,items:[{id:'file',filename:'rh-media-image.png',modality:'tongue',kind:'raw',status:'needs_review',sourceRef:{kind:'modality_file',id:'file',sha256:'a'.repeat(64)},taskCount:0,tasksNextCursor:null,tasks:[]}]};
 const h=render(fileBundle,'default',{onDirty:()=>{},route:{studyId:'study',visitId:'visit'},session:{actor:'actor',authVersion:1,verified:true,revision:1,view:{visit:{id:'visit',subject:{id:'subject'},status:'in_progress',scheduleState:'scheduled',visitPlan:{requirements:[]}},files,fileAccess:{capabilities:files.capabilities,preprocessedUploadStatus:'available'}}}});try{assert.match(h.text,/舌图原件 · 已绑定文件 · 待核对/);assert.match(h.text,/暂无关联处理任务/);assert.doesNotMatch(h.text,/舌图特征|舌象特征|数值：|提取版本：/);assert(h.nodes.some(n=>n.type==='RegisteredMediaList'&&n.props.fileId==='file'&&n.props.visitId==='visit'));assert.match(h.text,/PNG|JPEG|JPG/);}finally{h.dispose();}
});
