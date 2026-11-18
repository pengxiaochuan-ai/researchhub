import {createHash} from 'node:crypto';
import {completeTextWindow} from '../hub-sources/article-selection-v2.mjs';
import {routeDigest} from './skill-routing.mjs';
const sha=text=>createHash('sha256').update(text).digest('hex');
const fail=code=>{throw Object.assign(Error(code),{code});};
export function buildSnapshotPack(source){
 const external=source.kind==='pubmed-live',text=external?source.abstract:source.text;
 if(typeof text!=='string'||!text.trim())fail('HUB_INTERPRETATION_EVIDENCE_INSUFFICIENT');
 const fragments=[];let cursor=0,remaining=6000;
 while(cursor<text.length&&remaining>0&&fragments.length<6){
  const w=completeTextWindow(text.slice(cursor),Math.min(1200,remaining));if(!w.complete||!w.text)break;
  const offset=cursor+w.offset;fragments.push({id:'fragment-'+(fragments.length+1),field:external?'abstract':'body',role:external?'abstract':'fragment',offset,length:w.text.length,text:w.text,textHash:sha(w.text),complete:true,locator:{kind:external?'pubmed-abstract-offset':'source-fragment-offset'}});
  cursor=offset+w.text.length;remaining-=w.text.length;
 }
 if(!fragments.length)fail('HUB_INTERPRETATION_EVIDENCE_INSUFFICIENT');
 const data={adapterSchema:'hub-snapshot-article-pack.v1',binding:{recordId:external?'pubmed:'+source.pmid:'hub-fragment:'+source.id,articleVersion:source.contentHash??routeDigest(source),retrievedAt:source.retrievedAt??null},policyVersion:'rh-article-evidence-v2',source:{title:source.title,doi:source.doi??null,sourceUrl:source.sourceUrl},
  coverage:{notice:external?'基于检索时保存的摘要，未读取全文':'基于当前获准来源选段，未读取全文',fields:[external?'abstract':'body'],characters:6000-remaining,sections:{},locator:'field-offset',articleType:/protocol/i.test(source.title)?'protocol':'unclassified'},omissions:['body-unavailable','table-unavailable','image-pixels','supplement-content',...(cursor<text.length?['unselected-text']:[])],fragments};
 return{...data,packHash:routeDigest(data)};
}
export function assertSnapshotPack(pack){
 const {packHash,...data}=pack??{};
 if(pack?.adapterSchema!=='hub-snapshot-article-pack.v1'||routeDigest(data)!==packHash||!pack.fragments?.length||pack.fragments.some(f=>sha(f.text)!==f.textHash||f.length!==f.text.length||!f.complete))fail('HUB_INTERPRETATION_EVIDENCE_CHANGED');
 return pack;
}
