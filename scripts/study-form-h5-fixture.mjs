// Explicit synthetic transport substitute: creates no SMTP/HTTP connection.
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {existsSync} from 'node:fs';
import {openHarness,json,save,key,privateDir,evidenceDir,purpose} from './study-form-runtime.mjs';
import {runtimeDependencies} from '../server/research-runtime/dependencies.mjs';
const native=process.argv[3]==='--native';assert.deepEqual(process.argv.slice(2),native?['--local-synthetic','--native']:['--local-synthetic']);
const caseName=native?'H5_NATIVE':'H5',stem=native?'h5-native-invitation':'h5-invitation';
const h=await openHarness(),f=json(privateDir+'fixture.json');assert(f.protocolReady&&f.cases.H5);assert(!existsSync(privateDir+stem+'.json'),'DO_NOT_MINT_SECOND_INVITATION');
await h.read(async tx=>{const [row]=await tx.$queryRaw`SELECT manifest FROM wp01_meta.fixture_run WHERE run_id=${f.runId}`;assert.equal(row.manifest.purpose,purpose);assert.equal(row.manifest.studyId,f.study.id);});
if(native){
 assert(!f.cases.H5_NATIVE,'NATIVE_CASE_ALREADY_EXISTS');
 const root='/research-studies/'+f.study.id,subject=(await h.post(root+'/subjects',{requestKey:key(),subjectId:'SYNTHETIC-PHQ9-H5-NATIVE-'+f.runId.slice(-8)})).subject,p=root+'/subjects/'+subject.id+'/participation';
 for(const event of [{kind:'screening',decision:'passed',method:'manual'},{kind:'research_consent',decision:'granted',signer:'合成主体',textVersion:f.policy.sections.researchConsent.rules.textVersion},{kind:'data_use_consent',decision:'granted',signer:'合成主体',scope:f.policy.sections.dataUse.rules.scope}])await h.post(p+'/events',{requestKey:key(),expectedPolicyVersionId:f.policy.id,expectedPolicyHash:f.policy.contentHash,event:{...event,effectiveAt:new Date(Date.now()-1000).toISOString(),evidence:'本轮原生200%合成浏览器验证'}});
 await h.post(p+'/enroll',{requestKey:key(),expectedPolicyVersionId:f.policy.id,expectedPolicyHash:f.policy.contentHash});
 const visits=await h.get(root+'/visits?subjectId='+subject.id);assert.equal(visits.items.length,1);f.cases.H5_NATIVE={subject,visitId:visits.items[0].id};save(privateDir+'fixture.json',f);
}
await h.read(async tx=>assert(await tx.subjectVisit.findFirst({where:{...f.scope,id:f.cases[caseName].visitId,acceptanceFixture:false}})));
const {load}=runtimeDependencies(),core={register:load('study-operations/formal-outreach','registerEmailRecipientInTransaction'),prepare:load('study-operations/formal-outreach','prepareEmailInvitationInTransaction'),send:load('study-operations/formal-outreach','sendEmailInvitationInTransaction')};
const user={accountId:h.actor.id,tenantId:h.actor.tenantId,authVersion:h.actor.authVersion,role:h.actor.role,isTenantAdmin:true};
const previous=process.env.CONTACT_ENCRYPTION_KEY;process.env.CONTACT_ENCRYPTION_KEY=createHmac('sha256',h.runtime.secret).update('researchhub:local-contact:v1').digest('hex');
let token,prepared,receipt;
try{
 await h.direct(async tx=>{
  const participant=await core.register(tx,user,f.scope,{visitId:f.cases[caseName].visitId,address:'synthetic-'+caseName.toLowerCase()+'-'+f.runId+'@example.test',emailConsentConfirmed:true});
  prepared=await core.prepare(tx,user,f.scope,{visitId:f.cases[caseName].visitId,formVersionId:f.refs.form,participantId:participant.participantId});
  receipt=await core.send(tx,user,f.scope,prepared.capability,async(address,value)=>{
   assert(address.endsWith('@example.test'));token=value;
   return {status:'accepted',providerMessageId:'synthetic-no-send-'+f.runId};
  });
  await tx.auditLog.create({data:{...f.scope,accountId:h.actor.id,action:'synthetic_fixture.h5.no_send_transport',target:prepared.invitationId,meta:{runId:f.runId,purpose,syntheticOnly:true,emailSent:false,transportSubstitute:'in-process accepted receipt; no SMTP or external HTTP'}}});
 });
}finally{if(previous===undefined)delete process.env.CONTACT_ENCRYPTION_KEY;else process.env.CONTACT_ENCRYPTION_KEY=previous;}
assert.equal(typeof token,'string');
save(privateDir+stem+'.json',{token,assignmentId:prepared.assignmentId,invitationId:prepared.invitationId,studyId:f.study.id});
f.cases[caseName].assignmentId=prepared.assignmentId;f.cases[caseName].invitationId=prepared.invitationId;f.h5TransportSubstitute=true;f.emailSent=false;
save(privateDir+'fixture.json',f);save(evidenceDir+'fixture.json',f);save(evidenceDir+stem+'-preparation.json',{at:new Date().toISOString(),syntheticOnly:true,caseName,studyId:f.study.id,invitationId:prepared.invitationId,assignmentId:prepared.assignmentId,receipt,emailSent:false,transportSubstitute:'in-process accepted receipt only; not email delivery acceptance',network:h.network});
console.log(JSON.stringify({prepared:true,emailSent:false,transportSubstitute:true,evidence:evidenceDir+stem+'-preparation.json'}));
