import{createHash}from'node:crypto';
export const ARTICLE_ORIGINAL_MISSING_MESSAGE='这篇论文的原文尚未准备完整，暂不能进行 AI 解读。请联系管理员补齐。';
const changed=()=>{throw Object.assign(Error('ARTICLE_EVIDENCE_CHANGED'),{code:'ARTICLE_EVIDENCE_CHANGED',status:409})};
// The binding selects one authoritative storage reader. A storage failure never
// changes its backend or substitutes an unverified filesystem copy.
export async function readArticleOriginal(asset,reader){
 if(!asset||!/^[a-f0-9]{64}$/.test(asset.sha256??'')||asset.localObjectKey!=='objects/'+asset.sha256||!Number.isSafeInteger(asset.byteCount)||asset.byteCount<1||asset.byteCount>8388608)changed();
 if(typeof reader!=='function')throw Error('ARTICLE_SOURCE_READER_REQUIRED');
 let bytes;
 try{bytes=await reader(asset)}catch(error){
  if(['NoSuchKey','ENOENT'].includes(error?.code))throw Object.assign(Error(ARTICLE_ORIGINAL_MISSING_MESSAGE),{code:'ARTICLE_ORIGINAL_MISSING',status:422});
  throw error;
 }
 if(!Buffer.isBuffer(bytes)||bytes.length!==asset.byteCount||createHash('sha256').update(bytes).digest('hex')!==asset.sha256)changed();
 return bytes;
}
