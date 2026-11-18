export const contentFail=(code,status=409)=>{throw Object.assign(Error(code),{code,status});};
export const contentId=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
export const contentOnly=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)))contentFail('MEDIA_CONTENT_INPUT',400);};
export function normalizeContentRequest(v){contentOnly(v,['requestKey','expectedMediaVersion']);if(!contentId(v.requestKey)||!Number.isSafeInteger(v.expectedMediaVersion)||v.expectedMediaVersion<1)contentFail('MEDIA_CONTENT_INPUT',400);return{requestKey:v.requestKey,expectedMediaVersion:v.expectedMediaVersion};}
const us=v=>typeof v==='string'&&/^(0|[1-9][0-9]{0,12})$/.test(v);
export function bindFrameDescriptions(descriptions,frames){
 if(!Array.isArray(descriptions)||descriptions.length!==frames.length)contentFail('MEDIA_CONTENT_EVIDENCE');const byId=new Map(frames.map(f=>[f.id,f])),seen=new Set();
 return descriptions.map(d=>{contentOnly(d,['frameId','description']);const f=byId.get(d.frameId);if(!f||seen.has(d.frameId)||typeof d.description!=='string'||!d.description.trim()||d.description.length>4000)contentFail('MEDIA_CONTENT_EVIDENCE');seen.add(d.frameId);return{...f,description:d.description};});
}
export function validateContentOutput(v,manifest,channel){
 contentOnly(v,['schema','sourceSha256','sourceVersion','channel','status','coverage','evidence','usage','reason']);
 if(manifest.timelineOriginUs!=='0')contentFail('MEDIA_CONTENT_TIMELINE_UNSUPPORTED');
 if(v.schema!=='hub-media-content-output.v1'||v.sourceSha256!==manifest.sourceSha256||v.sourceVersion!==manifest.sourceVersion||v.channel!==channel||!['audio','visual'].includes(channel)||!['complete','not_applicable'].includes(v.status)||!Array.isArray(v.evidence)||v.evidence.length>10000)contentFail('MEDIA_CONTENT_EVIDENCE');
 contentOnly(v.coverage,['startUs','endUs']);if(!us(v.coverage.startUs)||!us(v.coverage.endUs)||BigInt(v.coverage.startUs)>BigInt(v.coverage.endUs)||BigInt(v.coverage.endUs)>BigInt(manifest.durationUs))contentFail('MEDIA_CONTENT_EVIDENCE');
 contentOnly(v.usage,['executor','requests','tokens','seconds','configHash']);if(typeof v.usage.executor!=='string'||!Number.isInteger(v.usage.requests)||v.usage.requests<0||v.usage.requests>100)contentFail('MEDIA_CONTENT_EVIDENCE');
 const seen=new Set();for(const e of v.evidence){
  contentOnly(e,['id','kind','text','startUs','endUs','estimated','pts','timeBase','sha256','imageKey','frameId','parentId']);
  if(!contentId(e.id)||seen.has(e.id)||typeof e.text!=='string'||!e.text.trim()||e.text.length>16000||!us(e.startUs)||!us(e.endUs)||BigInt(e.startUs)>BigInt(e.endUs)||BigInt(e.endUs)>BigInt(manifest.durationUs))contentFail('MEDIA_CONTENT_EVIDENCE');seen.add(e.id);
  if(channel==='audio'&&(e.kind!=='transcript'||e.estimated!==true||e.imageKey!==undefined)||channel==='visual'&&(e.kind!=='frame'||e.estimated!==false||e.startUs!==e.endUs||typeof e.pts!=='string'||!/^\d+$/.test(e.pts)||!/^\d+\/[1-9]\d*$/.test(e.timeBase??'')||!/^[a-f0-9]{64}$/.test(e.sha256??'')))contentFail('MEDIA_CONTENT_EVIDENCE');
 }
 for(const e of v.evidence)if(channel==='visual'){
  if(e.timeBase!==manifest.videoTimeBase)contentFail('MEDIA_CONTENT_EVIDENCE');
  const[num,den]=e.timeBase.split('/').map(BigInt);if(BigInt(e.pts)*num*1000000n/den!==BigInt(e.startUs))contentFail('MEDIA_CONTENT_EVIDENCE');
 }
 if(v.status==='not_applicable'&&v.evidence.length)contentFail('MEDIA_CONTENT_EVIDENCE');return v;
}
