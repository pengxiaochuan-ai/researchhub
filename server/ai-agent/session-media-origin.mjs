import {sessionMediaRequestAllowed,MEDIA_REQUEST_MARKER} from '../../src/session-media-session.js';
const origin='http://127.0.0.1:19501',hosts=['127.0.0.1:19501','127.0.0.1:19502'],forwarded=['forwarded','x-forwarded-host','x-forwarded-proto'];
export function mediaSourceMetadata(req){
 const h=req.headers??{};
 return{method:req.method,hostMatches:hosts.includes(h.host),originKind:h.origin===origin?'exact':h.origin==='http://127.0.0.1'?'port-stripped':h.origin==='null'?'opaque':h.origin===undefined?'missing':'other',forwardedPresent:forwarded.some(k=>Object.hasOwn(h,k))};
}
export function mediaSourceAllowed(req){
 const h=req.headers??{};
 if(!hosts.includes(h.host)||forwarded.some(k=>Object.hasOwn(h,k)))return false;
 if(req.method!=='POST'||h.origin===origin)return true;
 // Same narrowly scoped browser proof as the existing local login fix.
 // Never accept null, a missing Origin, another port, or a production origin.
 if(h.origin!=='http://127.0.0.1'||!['127.0.0.1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress)||h['sec-fetch-site']!=='same-origin'||h['sec-fetch-mode']!=='same-origin'||h['sec-fetch-dest']!=='empty'||h['x-researchhub-request']!==MEDIA_REQUEST_MARKER)return false;
 const path=req.originalUrl??req.url;
 if(typeof path!=='string'||!path.startsWith('/api/')||!sessionMediaRequestAllowed('POST',path.slice(4)))return false;
 const chunk=/\/chunks\/[0-9]+$/.test(path),type=h['content-type']?.split(';')[0].trim().toLowerCase();
 if(type!==(chunk?'application/octet-stream':'application/json'))return false;
 try{const page=new URL(h.referer);return page.origin===origin&&!page.username&&!page.password;}catch{return false;}
}
