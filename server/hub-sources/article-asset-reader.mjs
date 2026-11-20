import{createHash}from'node:crypto';
const changed=()=>{throw Object.assign(Error('ARTICLE_EVIDENCE_CHANGED'),{code:'ARTICLE_EVIDENCE_CHANGED',status:409})};
// The binding selects one authoritative storage reader. A storage failure never
// changes its backend or substitutes an unverified filesystem copy.
export async function readArticleOriginal(asset,reader){
 if(!asset||!/^[a-f0-9]{64}$/.test(asset.sha256??'')||asset.localObjectKey!=='objects/'+asset.sha256||!Number.isSafeInteger(asset.byteCount)||asset.byteCount<1||asset.byteCount>8388608)changed();
 if(typeof reader!=='function')throw Error('ARTICLE_SOURCE_READER_REQUIRED');
 const bytes=await reader(asset);
 if(!Buffer.isBuffer(bytes)||bytes.length!==asset.byteCount||createHash('sha256').update(bytes).digest('hex')!==asset.sha256)changed();
 return bytes;
}
