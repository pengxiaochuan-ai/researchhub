import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {request as httpRequest} from 'node:http';
import {base,root,directoryLogin,directoryRequest,directoryPath} from './directory-runtime.mjs';
const out=root+'researchhub/docs/testing/evidence/team-origin-rejection-2026-11-05/http-'+randomUUID()+'/';mkdirSync(out,{recursive:true});
const admin=await directoryLogin('admin'),owner=await directoryLogin('owner'),team='rhde-19ccf8f5caa84034b0dea6a897a0b43b',real='rhde-c334b97521154b98a52f8fba3926afde';
const before=await directoryRequest(admin,directoryPath+'team-workspaces/'+team),realBefore=await directoryRequest(admin,directoryPath+'team-workspaces/'+real),checks=[];
const proof={Origin:'http://127.0.0.1',Referer:base+'/pages/g02/?view=directory-review','Content-Type':'application/json','Sec-Fetch-Site':'same-origin','Sec-Fetch-Mode':'same-origin','Sec-Fetch-Dest':'empty','X-ResearchHub-Request':'team-workspace-v1'};
async function probe(label,path,headers,status,cookie=admin){
 // Raw HTTP preserves the exact negative-test headers. Node fetch overwrites
 // Sec-Fetch-Mode from its own Request.mode, hiding which combination was sent.
 const {actual,d}=await new Promise((resolve,reject)=>{const r=httpRequest(base+directoryPath+path,{method:'POST',headers:{...headers,...(cookie?{Cookie:cookie}:{}),'Content-Length':2}},s=>{let body='';s.setEncoding('utf8');s.on('data',part=>body+=part);s.on('end',()=>{try{resolve({actual:s.statusCode,d:JSON.parse(body)});}catch(e){reject(e);}});});r.on('error',reject);r.end('{}');});
 assert.equal(actual,status,label+' '+JSON.stringify(d));checks.push({label,path,status:actual,code:d.code??null});
}
try{
 for(const path of ['team-workspaces','team-workspaces/'+team,'team-workspaces/'+team+'/reviews'])await probe('verified-port-stripped-browser-reaches-input-validation',path,proof,400);
 for(const[key,value]of [['Origin','https://evil.test'],['Origin','http://127.0.0.1:80'],['Origin','null'],['Origin',undefined],['Referer','http://127.0.0.1:19503/pages/g02/'],['Referer',undefined],['Sec-Fetch-Site','same-site'],['Sec-Fetch-Site','cross-site'],['Sec-Fetch-Site',undefined],['Sec-Fetch-Mode','cors'],['Sec-Fetch-Mode',undefined],['Sec-Fetch-Dest','document'],['X-ResearchHub-Request',undefined],['Content-Type','text/plain'],['X-Forwarded-Host','127.0.0.1:19501']]){const h={...proof};if(value===undefined)delete h[key];else h[key]=value;await probe('reject-'+key+'-'+value,'team-workspaces/'+team,h,403);}
 await probe('other-directory-write-keeps-original-origin-rule','entities',proof,403);
 await probe('normal-full-origin-still-valid','team-workspaces/'+team,{Origin:base,'Content-Type':'application/json'},400);
 await probe('owner-still-forbidden','team-workspaces/'+team,proof,403,owner);
 await probe('anonymous-still-unauthorized','team-workspaces/'+team,proof,401,'');
 assert.deepEqual(await directoryRequest(admin,directoryPath+'team-workspaces/'+team),before);
 assert.deepEqual(await directoryRequest(admin,directoryPath+'team-workspaces/'+real),realBefore);
 writeFileSync(out+'result.json',JSON.stringify({passed:true,checks,noBusinessWrites:true,paidCalls:0},null,2));console.log(JSON.stringify({passed:true,checks:checks.length,evidence:out}));
}catch(e){writeFileSync(out+'failure.json',JSON.stringify({passed:false,checks,message:e.message},null,2));console.error(JSON.stringify({passed:false,message:e.message,evidence:out}));process.exitCode=1;}
