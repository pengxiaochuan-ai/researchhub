// Issue exactly one approved invitation through the existing service and real
// loopback SMTP. The recipient must explicitly accept in the original page.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {loadCatalogTarget} from './research-assets-catalog-schema.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {createWp02Repository} from '../server/wp02/repository.mjs';
import {createMemberInvitations} from '../server/wp02/invitation-service.mjs';
import {createAccountMailer} from '../server/wp02/mailer.mjs';
import {readWp02Config} from '../server/wp02/config.mjs';
import {ASSET_MEMBER_ROLE,ASSET_MEMBER_EMAIL,assetMemberRoleAllowed} from '../server/research-assets/member-local-invitation.mjs';
assert.deepEqual(process.argv.slice(2),['--issue-approved-invitation']);
const {env,ids}=loadCatalogTarget();assert.equal((await assertFixtureTarget(env)).databaseName,'wp01_test_full_baseline');
const root=fileURLToPath(new URL('../../',import.meta.url)),runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json')),require=createRequire(root+'app/server/package.json');
require('ts-node').register({project:root+'app/server/tsconfig.json',transpileOnly:true});
const {lockAuthorizationMutation}=require(root+'app/server/src/common/worker-publication.ts'),db=createWp02Repository({tenantId:ids.tenant,transact:run=>withFixtureTransaction(env,'direct',run),lockAuthorization:lockAuthorizationMutation});
const directory=root+'.tmp/research-assets-completion/',privatePath=directory+'member-invitation.json';mkdirSync(directory,{recursive:true,mode:0o700});
if(existsSync(privatePath)){console.log(JSON.stringify({alreadyIssued:true,autoResent:false}));process.exit(0);}
assert(JSON.parse(readFileSync(new URL('../docs/planning/research-assets-completion-2026-11-16/evidence/business-member-initialized.json',import.meta.url))).passed);
const config=readWp02Config({file:root+'researchhub/.env.smtp.local',approvedMode:'capture'}),mailDirectory=root+'.tmp/researchhub-wp02/mail/';let delivered;
const mailer=createAccountMailer(config,{receipt:id=>{const receipt=JSON.parse(readFileSync(mailDirectory+id+'.json'));assert.equal(receipt.to,ASSET_MEMBER_EMAIL);delivered=receipt;return receipt;}});
const service=createMemberInvitations({db,secret:runtime.secret,config,target:{tenantId:ids.tenant,groupId:ids.group,projectId:ids.project,readerRoleId:ASSET_MEMBER_ROLE},allowTenantAdmin:true,readerRoleAllowed:assetMemberRoleAllowed,targetRoleName:'科研资产成员',mailer});
const admin=await db.transaction(tx=>tx.account.findFirst({where:{id:ids.admin,tenantId:ids.tenant,status:'active'},select:{authVersion:true}}));assert(admin);
const invitation=await service.issue({user:{tenantId:ids.tenant,accountId:ids.admin,authVersion:admin.authVersion},groupId:ids.group,projectId:ids.project,ip:'c1-asset-member-invite'},{email:ASSET_MEMBER_EMAIL,requestKey:'c1-asset-member-invite-20261117'});
assert.equal(invitation.deliveryStatus,'captured');assert(delivered,'No automatic resend or fabricated receipt');
const token=delivered.text.match(/#invite=([A-Za-z0-9_-]{43})/)?.[1];assert(token);
writeFileSync(privatePath,JSON.stringify({invitationId:invitation.id,token,messageId:delivered.id}),{flag:'wx',mode:0o600});
const result={passed:true,at:new Date().toISOString(),invitationId:invitation.id,messageId:delivered.id,messageDigest:delivered.digest,realLocalSmtp:true,recipient:ASSET_MEMBER_EMAIL,accepted:false,autoResent:false,modelCalls:0};
writeFileSync(new URL('../docs/planning/research-assets-completion-2026-11-16/evidence/business-member-invitation.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
