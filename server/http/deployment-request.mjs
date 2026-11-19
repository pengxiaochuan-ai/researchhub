const reject=()=>{throw Object.assign(Error('请求来源不符合当前站点配置。'),{status:403,code:'RESEARCH_ORIGIN_REJECTED'});};
export function deploymentRequestPolicy({origin,apiAuthority}){
 let site,api;try{site=new URL(origin);api=new URL(site.protocol+'//'+apiAuthority);}catch{reject();}
 if(site.origin!==origin||site.username||site.password||!['https:','http:'].includes(site.protocol)||site.protocol==='http:'&&!/^127\.0\.0\.1:\d+$/.test(site.host)||api.host!==apiAuthority||api.username||api.password||api.pathname!=='/'||api.search||api.hash)reject();
 return Object.freeze({origin,hosts:Object.freeze([...new Set([site.host,apiAuthority])])});
}
export function assertDeploymentRequest(req,policy,{json=true}={}){
 const h=req.headers??{};
 if(!policy?.hosts?.includes(h.host)||['forwarded','x-forwarded-host','x-forwarded-proto'].some(k=>Object.hasOwn(h,k))||h['sec-fetch-site']==='cross-site')reject();
 if(!['GET','HEAD'].includes(req.method)&&(h.origin!==policy.origin||json&&!/^application\/json(?:\s*;.*)?$/i.test(h['content-type']??'')))reject();
 return true;
}
