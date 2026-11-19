import test from'node:test';import assert from'node:assert/strict';import{deploymentRequestPolicy,assertDeploymentRequest}from'./deployment-request.mjs';
const policy=deploymentRequestPolicy({origin:'https://hub.example.test',apiAuthority:'api:19652'});
test('deployment request binding accepts only explicit hosts and exact mutation origin',()=>{
 const req={method:'POST',headers:{host:'hub.example.test',origin:policy.origin,'content-type':'application/json','sec-fetch-site':'same-origin'}};assert(assertDeploymentRequest(req,policy));
 for(const headers of [{host:'old.example.test'},{origin:'https://foreign.example.test'},{'x-forwarded-host':'hub.example.test'},{'content-type':'text/plain'},{'sec-fetch-site':'cross-site'}])assert.throws(()=>assertDeploymentRequest({...req,headers:{...req.headers,...headers}},policy),e=>e.status===403);
 assert(assertDeploymentRequest({method:'GET',headers:{host:'api:19652'}},policy));
 assert.throws(()=>deploymentRequestPolicy({origin:'http://remote.example.test',apiAuthority:'api:19652'}));
});
