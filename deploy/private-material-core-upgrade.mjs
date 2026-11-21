import{readFileSync,writeFileSync,realpathSync,existsSync,mkdirSync}from'node:fs';import{join,resolve,dirname,basename}from'node:path';import{createHash}from'node:crypto';
import{verifyCoreBundle,sealCoreBundle}from'./core-bundle.mjs';import{verifyBackendPackage}from'./backend-package.mjs';
export const PRIVATE_UPGRADE_SOURCE='c5a27d1cdb85681bf21821e7b8c8eabd482469fb7c87031dabb5faa69cf9e087';
export const PRIVATE_UPGRADE_TARGET='5ae81a684c60472a31a71bdfbde1f2b7b22f2ac7b5f7132ca278d51ded6f7222';
const hash=s=>createHash('sha256').update(s).digest('hex');
export function privateCoreEdits(before){
 const worker=before['src/common/worker-authorization.ts'],admin=before['src/common/hub-knowledge-admin.ts'];
 const needle="        if (requirements.toolKeys?.some(key => key !== 'knowledge.search')) return deny();\n        permissionGrant = hubChatAdminToolPermissions();";
 if(worker.split(needle).length!==2||admin.split('(!hub && !kbId && !articleTaskContext(session.contextKey, task.payload))').length!==2)throw Error('PRIVATE_CORE_BASELINE_DRIFT');
 return{
  'src/common/worker-authorization.ts':"import {isHubPrivateMaterialTask,hubPrivateMaterialToolPermissions} from './hub-private-materials';\n"+worker.replace(needle,"        const privateMaterials = requirements.toolKeys?.includes('file.read') && await isHubPrivateMaterialTask(tx,user,ref.taskId,groupId,projectId);\n        if (requirements.toolKeys?.some(key => key !== 'knowledge.search' && !(privateMaterials && key === 'file.read'))) return deny();\n        permissionGrant = privateMaterials ? hubPrivateMaterialToolPermissions() : hubChatAdminToolPermissions();"),
  'src/common/hub-knowledge-admin.ts':"import {isHubPrivateMaterialTask} from './hub-private-materials';\n"+admin.replace('(!hub && !kbId && !articleTaskContext(session.contextKey, task.payload))','(!hub && !kbId && !articleTaskContext(session.contextKey, task.payload) && !(await isHubPrivateMaterialTask(tx,user,task.id,groupId,projectId)))'),
  'src/common/hub-private-materials.ts':readFileSync(new URL('./runtime-adaptations/hub-private-materials.ts',import.meta.url),'utf8'),
 };
}
export function upgradeFrozenPrivateMaterialCore({source,output}){
 const proof=JSON.parse(readFileSync(new URL('./runtime-adaptations/private-material-admin.json',import.meta.url),'utf8'));
 source=realpathSync(resolve(source));output=join(realpathSync(dirname(resolve(output))),basename(resolve(output)));if(existsSync(output)||output===source||output.startsWith(source+'/')||source.startsWith(output+'/'))throw Error('PRIVATE_CORE_OUTPUT_REJECTED');
 const release=verifyBackendPackage(source);if(release.coreDigest!==PRIVATE_UPGRADE_SOURCE||proof.sourceCoreDigest!==PRIVATE_UPGRADE_SOURCE)throw Error('PRIVATE_CORE_BASELINE_REJECTED');
 const files=verifyCoreBundle(join(source,'core'),PRIVATE_UPGRADE_SOURCE).files,save=(name,bytes)=>{const path=join(output,name);mkdirSync(dirname(path),{recursive:true,mode:0o700});writeFileSync(path,bytes,{mode:0o600})};
 for(const f of files)save('core/'+f.path,readFileSync(join(source,'core',f.path)));save('core/core-manifest.json',readFileSync(join(source,'core/core-manifest.json')));
 for(const f of release.hubFiles)save('hub/'+f.path,readFileSync(join(source,'hub',f.path)));for(const n of['release.json','Dockerfile','.dockerignore'])save(n,readFileSync(join(source,n)));
 const before=Object.fromEntries(Object.keys(proof.before).map(n=>{const text=readFileSync(join(source,'core',n),'utf8');if(hash(text)!==proof.before[n])throw Error('PRIVATE_CORE_BASELINE_DRIFT');return[n,text]})),edits=privateCoreEdits(before);
 for(const[n,text]of Object.entries(edits)){if(hash(text)!==proof.after[n])throw Error('PRIVATE_CORE_ADAPTER_DRIFT');save('core/'+n,text)}
 save('core/prisma/runtime-adaptations/private-material-admin.json',JSON.stringify(proof,null,2)+'\n');const sealed=sealCoreBundle(join(output,'core'));
 if(sealed.digest!==PRIVATE_UPGRADE_TARGET)throw Error('PRIVATE_CORE_DIGEST_CHANGED');
 const result={...release,coreDigest:sealed.digest,compatibleHubCoreDigest:PRIVATE_UPGRADE_SOURCE,adaptations:[...release.adaptations,'owner-fixed-private-materials']};save('release.json',JSON.stringify(result,null,2)+'\n');verifyBackendPackage(output);return result;
}
