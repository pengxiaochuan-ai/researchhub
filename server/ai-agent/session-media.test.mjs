import test from 'node:test';
import assert from 'node:assert/strict';
const media=await import('./session-media.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return null;throw e;});
test('media initialization accepts only supported canonical video metadata and 500MiB',()=>{
 assert(media,'media service missing');
 assert.deepEqual(media.normalizeMediaInput({requestKey:'video-test-1',filename:'synthetic.MP4',mimeType:'video/mp4',size:524288000}),{requestKey:'video-test-1',extension:'mp4',contentType:'video/mp4',byteSize:524288000});
 for(const value of [0,524288001,1.5,'10'])assert.throws(()=>media.normalizeMediaInput({requestKey:'video-test-1',filename:'x.mp4',mimeType:'video/mp4',size:value}),/MEDIA_INPUT/);
});
test('media rejects arbitrary paths, unknown fields, disguised documents and mismatched MIME',()=>{
 assert(media,'media service missing');
 const valid={requestKey:'video-test-1',filename:'x.mp4',mimeType:'video/mp4',size:123};
 for(const patch of [{filename:'x.pdf'},{filename:'../x.mp4'},{mimeType:'text/html'},{tenantId:'other'},{storageKey:'arbitrary'}])assert.throws(()=>media.normalizeMediaInput({...valid,...patch}),/MEDIA_INPUT/);
 assert.equal(media.normalizeMediaInput({...valid,filename:'x.webm',mimeType:''}).contentType,'video/webm');
});
test('public media separates archive/checking and never exposes object keys or pretends content was read',()=>{
 assert(media,'media service missing');
 const row={id:'media-test',version:2,extension:'mp4',safe_filename:'media-test.mp4',byte_size:100n,archive_state:'archived',inspection_state:'unavailable',inspection_classification:'corrupt',inspection:{durationSeconds:3,hasVideo:false,hasAudio:false},storage_key:'private',created_at:new Date('2026-11-16T00:00:00Z')};
 const value=media.projectMedia(row);
 assert.equal(value.archiveState,'archived');assert.equal(value.inspectionState,'unavailable');
 assert.equal(value.contentUnderstood,false);assert.equal(value.classification,'corrupt');
 assert(!JSON.stringify(value).includes('private'));assert.equal(value.byteSize,100);
});
test('video content questions stop before a Provider while explicit Hub/document questions keep their original path',async()=>{
 assert(media);let calls=0;
 const tx={$queryRawUnsafe:async()=>{calls++;return[{media:true,other:false}];}},u={tenantId:'t',studyGroupId:'g',researchProjectId:'p',accountId:'a'};
 await assert.rejects(media.assertMediaQuestionReadableInTx(tx,u,'s','请总结刚上传的视频讲了什么'),e=>e.code==='MEDIA_CONTENT_UNAVAILABLE');
 await assert.rejects(media.assertMediaQuestionReadableInTx(tx,u,'s','请总结一下'),e=>e.code==='MEDIA_CONTENT_UNAVAILABLE');
 await assert.rejects(media.assertMediaQuestionReadableInTx(tx,u,'s','视频里有几个人？'),e=>e.code==='MEDIA_CONTENT_UNAVAILABLE');
 await assert.rejects(media.assertMediaQuestionReadableInTx(tx,u,'s','视频中的人情绪如何？'),e=>e.code==='MEDIA_CONTENT_UNAVAILABLE');
 const before=calls;await media.assertMediaQuestionReadableInTx(tx,u,'s','只用Hub已审核资料总结针灸治疗抑郁的论文');assert.equal(calls,before);
 await media.assertMediaQuestionReadableInTx(tx,u,'s','仅分析PDF中的研究方案');assert.equal(calls,before);
 await media.assertMediaQuestionReadableInTx(tx,u,'s','只用Hub论文总结视频眼动领域的新研究');assert.equal(calls,before);
 await media.assertMediaQuestionReadableInTx(tx,u,'s','仅根据PDF概括论文的视频实验设计');assert.equal(calls,before);
});
