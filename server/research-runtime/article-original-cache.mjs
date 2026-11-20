import{readArticleOriginal}from'../hub-sources/article-asset-reader.mjs';
// One execution owns one verified original. Publication can re-check its DB
// binding and hash in memory without fetching storage while holding its lock.
export function createArticleOriginalCache(reader){
 let key,bytes,sealed=false;
 return{seal(){sealed=true},async read(asset){
  const requested=JSON.stringify([asset?.localObjectKey,asset?.sha256,asset?.byteCount]);
  if(bytes&&key===requested)return readArticleOriginal(asset,async()=>Buffer.from(bytes));
  if(sealed||key)throw Error('ARTICLE_EVIDENCE_CHANGED');
  const verified=await readArticleOriginal(asset,reader);key=requested;bytes=Buffer.from(verified);return Buffer.from(bytes);
 }};
}
