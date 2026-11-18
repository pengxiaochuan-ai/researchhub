import test from 'node:test';import assert from 'node:assert/strict';import{academicContentBodyRoute}from'./http-policy.mjs';
test('larger JSON allowance applies only to fixed Hub content writes',()=>{
 for(const[path,method]of [['/api/hubs/lingshu-xinyu/content-management','POST'],['/api/hubs/lingshu-xinyu/content-management/one','PATCH'],['/api/hubs/lingshu-xinyu/content-management/one/publications','POST'],['/api/hubs/lingshu-xinyu/content-management/one/withdrawals','POST']])assert.equal(academicContentBodyRoute(path,method),true);
 for(const[path,method]of [['/api/public/hubs/lingshu-xinyu/academic-content','POST'],['/api/hubs/other/content-management','POST'],['/api/account-access/registrations','POST'],['/api/hubs/lingshu-xinyu/content-management','GET'],['/api/hubs/lingshu-xinyu/content-management/one/unsafe','PATCH']])assert.equal(academicContentBodyRoute(path,method),false);
});
import {assertAcademicContentOrigin} from './http-policy.mjs';
test('F03 port-stripped local PATCH requires the exact save route and complete original browser proof',()=>{
 const req={method:'PATCH',path:'/api/hubs/lingshu-xinyu/content-management/synthetic-id',socket:{remoteAddress:'127.0.0.1'},headers:{host:'127.0.0.1:19502',origin:'http://127.0.0.1',referer:'http://127.0.0.1:19501/pages/g02/?view=academic-content','content-type':'application/json','sec-fetch-site':'same-origin','sec-fetch-mode':'same-origin','sec-fetch-dest':'empty','x-researchhub-request':'session-v1'}};
 assert.doesNotThrow(()=>assertAcademicContentOrigin(req,'http://127.0.0.1:19501'));assert.equal(req.method,'PATCH');
 for(const [key,value]of [['origin','null'],['referer','http://127.0.0.1:19503/'],['sec-fetch-site','cross-site'],['sec-fetch-mode','cors'],['host','evil.test'],['x-forwarded-host','127.0.0.1:19501'],['x-researchhub-request','other']])assert.throws(()=>assertAcademicContentOrigin({...req,headers:{...req.headers,[key]:value}},'http://127.0.0.1:19501'),{status:403});
 for(const path of ['/api/auth/renew','/api/hubs/other/content-management/synthetic-id','/api/hubs/lingshu-xinyu/content-management/synthetic-id/publications'])assert.throws(()=>assertAcademicContentOrigin({...req,path},'http://127.0.0.1:19501'),{status:403});
 assert.throws(()=>assertAcademicContentOrigin(req,'https://hub.example'),{status:403});assert.throws(()=>assertAcademicContentOrigin({...req,socket:{remoteAddress:'192.0.2.1'}},'http://127.0.0.1:19501'),{status:403});
 for(const key of ['referer','sec-fetch-site','sec-fetch-mode','sec-fetch-dest','x-researchhub-request','content-type']){const headers={...req.headers};delete headers[key];assert.throws(()=>assertAcademicContentOrigin({...req,headers},'http://127.0.0.1:19501'),{status:403});}
 for(const key of ['forwarded','x-forwarded-proto'])assert.throws(()=>assertAcademicContentOrigin({...req,headers:{...req.headers,[key]:'untrusted'}},'http://127.0.0.1:19501'),{status:403});
 assert.throws(()=>assertAcademicContentOrigin({...req,query:{extra:'1'}},'http://127.0.0.1:19501'),{status:403});assert.throws(()=>assertAcademicContentOrigin({...req,method:'PUT'},'http://127.0.0.1:19501'),{status:403});
 assert.doesNotThrow(()=>assertAcademicContentOrigin({...req,headers:{origin:'https://hub.example','content-type':'application/json'}},'https://hub.example'));
});
