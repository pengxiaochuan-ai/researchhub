import {test} from 'node:test';import assert from 'node:assert/strict';
import {createAdmissionGuard} from './controller.mjs';
class HttpException extends Error{constructor(body,status){super(body.message);this.body=body;this.status=status;}}
test('HTTP gate preserves public projection and exact self-service, checks every business request and fails closed',async()=>{
 let publicRoute=false,count=0,denied=true;
 const guard=createAdmissionGuard({reflector:{getAllAndOverride:()=>publicRoute},service:{hubKey:'lingshu-xinyu',assertApproved:async()=>{count++;if(denied)throw Object.assign(Error('pending'),{status:403,code:'HUB_ADMISSION_REQUIRED'});}},HttpException});
 const context=(path,method='GET')=>({getHandler(){},getClass(){},switchToHttp:()=>({getRequest:()=>({path,method,user:{accountId:'actor'}})})});
 assert.equal(await guard.canActivate(context('/api/auth/me')),true);assert.equal(count,0);
 assert.equal(await guard.canActivate(context('/api/hubs/lingshu-xinyu/admission')),true);assert.equal(count,0);
 for(const path of ['/api/hubs/lingshu-xinyu/admissions','/api/knowledge/bases','/api/ai/default-skills'])await assert.rejects(guard.canActivate(context(path)),e=>e.status===403&&e.body.code==='HUB_ADMISSION_REQUIRED');
 publicRoute=true;assert.equal(await guard.canActivate(context('/api/hubs/lingshu-xinyu/overview')),true);assert.equal(count,3);
 publicRoute=false;denied=false;await guard.canActivate(context('/api/knowledge/bases'));await guard.canActivate(context('/api/knowledge/bases'));assert.equal(count,5);
});
