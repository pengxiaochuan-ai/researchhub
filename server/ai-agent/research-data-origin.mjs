import {researchDataRequestAllowed,DATA_REQUEST_MARKER} from '../../src/research-data-session.js';
export function researchDataSourceAllowed(req){
 const h=req.headers??{},origin='http://127.0.0.1:19501';
 if(!['127.0.0.1:19501','127.0.0.1:19502'].includes(h.host)||['forwarded','x-forwarded-host','x-forwarded-proto'].some(k=>Object.hasOwn(h,k)))return false;
 if(req.method!=='POST'||h.origin===origin)return true;
 if(h.origin!=='http://127.0.0.1'||!['127.0.0.1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress)||h['sec-fetch-site']!=='same-origin'||h['sec-fetch-mode']!=='same-origin'||h['sec-fetch-dest']!=='empty'||h['x-researchhub-request']!==DATA_REQUEST_MARKER)return false;
 const path=req.originalUrl??req.url;if(typeof path!=='string'||!path.startsWith('/api/')||!researchDataRequestAllowed('POST',path.slice(4)))return false;
 const upload=/\/research-data$/.test(path),type=h['content-type']?.split(';')[0].trim().toLowerCase();if(type!==(upload?'multipart/form-data':'application/json'))return false;
 try{const page=new URL(h.referer);return page.origin===origin&&page.pathname==='/pages/ai01/'&&!page.username&&!page.password;}catch{return false;}
}
