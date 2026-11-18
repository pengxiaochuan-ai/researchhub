import {fileURLToPath} from 'node:url';
import {withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {createLocalResearchPrisma} from './research-creation-local-integration.mjs';
import {createLocalMaterialAccess} from './local-session-materials.mjs';
import {createResearchStudiesService} from '../server/research-studies/commands.mjs';
import {createDataAgentTargets} from '../server/ai-agent/data-agent-targets.mjs';
import {createSubjectProfileImports} from '../server/ai-agent/subject-profile-imports.mjs';
import {createNativeSubjectProfileAdapter} from './subject-profile-native.mjs';
export function createLocalSubjectProfileImports({env,ids,load,storage,transaction}){
 const run=transaction??(fn=>withFixtureTransaction(env,'app',fn)),root=fileURLToPath(new URL('../../',import.meta.url));
 const prisma=createLocalResearchPrisma({tenantId:ids.tenant,transaction:run});
 const studies=createResearchStudiesService({prisma,scope:{product:'researchhub',allowedTenantIds:[ids.tenant]},lockAuthorization:load('common/worker-publication','lockAuthorizationMutation'),createResearchProject:()=>{throw Error('PROFILE_IMPORT_CREATION_FORBIDDEN');}});
 const access=createLocalMaterialAccess({env,ids,load,transaction:(_u,fn)=>run(fn)});
 const targets=createDataAgentTargets({studies,sourceAccess:access,authorizeIngest:load('ingest/ingest-authorization','authorizeIngestInTransaction')});
 const logs=new (load('common/execution-log.service','ExecutionLogService'))({directory:root+'.tmp/researchhub-profile-import/logs',timezone:'Asia/Shanghai'});
 return createSubjectProfileImports({access,targets,native:createNativeSubjectProfileAdapter({root,load,executionLogs:logs}),storage,lockCaptureScope:load('study-operations/protocol-migration-lock','lockCaptureScope')});
}
