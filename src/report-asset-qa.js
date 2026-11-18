import {makeCatalogAssetUrl} from './research-assets-catalog-session.js';
const valid=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const keys=['reportQa','assetId','version','studyGroupId','researchProjectId'];
export function readReportQaRoute(search){
 const p=new URLSearchParams(search);if(!p.has('reportQa'))return null;
 if([...p.keys()].some(k=>!keys.includes(k)||p.getAll(k).length!==1)||keys.some(k=>!p.has(k))||p.get('reportQa')!=='1'||!['assetId','studyGroupId','researchProjectId'].every(k=>valid(p.get(k)))||!/^[1-9][0-9]{0,5}$/.test(p.get('version')))return{invalid:true};
 return{assetId:p.get('assetId'),version:Number(p.get('version')),scope:{studyGroupId:p.get('studyGroupId'),researchProjectId:p.get('researchProjectId')}};
}
export function reportQaHref(scope,assetId,version){const p=new URLSearchParams({reportQa:'1',assetId,version:String(version),...scope});if(readReportQaRoute(p)?.invalid)throw Error('报告问答入口无效。');return'/pages/ai01/?'+p;}
export const reportQaPath=(id,v,suffix='')=>'/research-assets/'+encodeURIComponent(id)+'/versions/'+v+'/report-qa'+suffix;
export function reportQaRequestAllowed(method,path){return method==='GET'&&/^\/research-assets\/[A-Za-z0-9_-]{1,160}\/versions\/[1-9][0-9]{0,5}\/report-qa$/.test(path)||method==='POST'&&/^\/research-assets\/[A-Za-z0-9_-]{1,160}\/versions\/[1-9][0-9]{0,5}\/(?:ai-consents|report-qa\/(?:search|fragment))$/.test(path);}
export function reportQaCitationHref(scope,id,v,e){
 if(!/^rf-[0-9]{4}-[a-f0-9]{12}$/.test(e.id)||!/^[a-f0-9]{64}$/.test(e.quoteHash)||!Number.isSafeInteger(e.startLine)||!Number.isSafeInteger(e.endLine)||e.startLine<1||e.endLine<e.startLine)throw Error('报告来源位置无效。');
 return makeCatalogAssetUrl(scope,id,v)+'#'+new URLSearchParams({reportQa:'1',fragmentId:e.id,quoteHash:e.quoteHash,startLine:e.startLine,endLine:e.endLine});
}
export function readReportQaCitation(hash){
 const p=new URLSearchParams(hash.replace(/^#/,'')),allowed=['reportQa','fragmentId','quoteHash','startLine','endLine'];if(!p.has('reportQa'))return null;
 if([...p.keys()].some(k=>!allowed.includes(k)||p.getAll(k).length!==1)||allowed.some(k=>!p.has(k))||p.get('reportQa')!=='1'||!/^rf-[0-9]{4}-[a-f0-9]{12}$/.test(p.get('fragmentId'))||!/^[a-f0-9]{64}$/.test(p.get('quoteHash'))||!['startLine','endLine'].every(k=>/^[1-9][0-9]{0,5}$/.test(p.get(k)))||Number(p.get('endLine'))<Number(p.get('startLine')))return{invalid:true};
 return{id:p.get('fragmentId'),quoteHash:p.get('quoteHash'),startLine:Number(p.get('startLine')),endLine:Number(p.get('endLine'))};
}
export function reportQaLoginCandidate({pathname,search='',hash=''}){const quote=pathname==='/pages/a02/'?readReportQaCitation(hash):null;return pathname+search+(quote&&!quote.invalid?hash:'');}
