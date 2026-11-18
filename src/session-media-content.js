const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const us=x=>typeof x==='string'&&/^(0|[1-9][0-9]{0,12})$/.test(x);
export const contentBase=(sid,mid)=>id(sid)&&id(mid)?`/sessions/${sid}/media/${mid}`:null;
export function assertContentRun(v,item){
 if(v?.schema!=='hub-media-content-run.v1'||!id(v.id)||!id(v.rootId)||v.mediaId!==item.id||v.mediaVersion!==item.version||!/^[a-f0-9]{64}$/.test(v.sourceSha256)||!Array.isArray(v.evidence)||v.evidence.length>10000||!['audio','visual'].every(c=>['idle','queued','running','complete','not_applicable','failed'].includes(v.channels?.[c]?.state)))throw Error('视频解读状态无法核对，请重新查询。');
 for(const e of v.evidence)if(!id(e.id)||!['transcript','frame'].includes(e.kind)||!us(e.startUs)||!us(e.endUs)||Number(e.startUs)>Number(e.endUs)||!us(v.manifest?.durationUs)||Number(e.endUs)>Number(v.manifest.durationUs)||typeof e.text!=='string'||typeof e.estimated!=='boolean')throw Error('视频证据无法核对，请重新查询。');
 return v;
}
export function assertPlaybackEvidence(e,run,item){if(!id(e?.id)||e.sourceSha256!==run.sourceSha256||e.mediaVersion!==item.version||!us(e.playbackUs)||!run.evidence.some(x=>x.id===e.id&&x.startUs===e.playbackUs)||Number(e.playbackUs)>Number(run.manifest.durationUs))throw Error('原视频或证据已变化，请重新查询。');return e;}
export const mediaTime=us=>{const seconds=Number(us)/1e6;return `${Math.floor(seconds/60)}:${Math.floor(seconds%60).toString().padStart(2,'0')}`;};
export function mediaEvidenceTime(e){if(e.kind!=='frame')return mediaTime(e.startUs);const ms=Math.round(Number(e.startUs)/1000),fraction=String(ms%1000).padStart(3,'0').replace(/0+$/,'');return`${Math.floor(ms/60000)}:${Math.floor(ms/1000)%60<10?'0':''}${Math.floor(ms/1000)%60}${fraction?'.'+fraction:''}`;}
