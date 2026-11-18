import {createAcademicContentService} from './service.mjs';
import {createAcademicContentControllers} from './controller.mjs';
export function assembleAcademicContent({prisma,scope,require,load,origin}){
 if(scope?.product!=='researchhub'||scope.allowedTenantIds?.length!==1)throw Error('CONTENT_DEPLOYMENT_REQUIRED');
 const service=createAcademicContentService({tenantId:scope.allowedTenantIds[0],transact:fn=>prisma.elevated.$transaction(fn),lockAuthorization:load('common/worker-publication','lockAuthorizationMutation')});
 return{service,Controllers:createAcademicContentControllers({require,service,origin})};
}
