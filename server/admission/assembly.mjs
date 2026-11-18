import {createAdmissionService} from './service.mjs';
import {createAdmissionController,createAdmissionGuard} from './controller.mjs';
export function assembleAdmission({prisma,scope,require,load,origin}){
 if(scope?.product!=='researchhub'||scope.allowedTenantIds?.length!==1)throw Error('HUB_ADMISSION_DEPLOYMENT_REQUIRED');
 const service=createAdmissionService({transact:fn=>prisma.elevated.$transaction(fn),tenantId:scope.allowedTenantIds[0],lockAuthorization:load('common/worker-publication','lockAuthorizationMutation')});
 const {HttpException}=require('@nestjs/common');
 return{service,Controller:createAdmissionController({require,service,origin}),guard:reflector=>createAdmissionGuard({reflector,service,HttpException})};
}
