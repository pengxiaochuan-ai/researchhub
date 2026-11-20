import {readFileSync,writeFileSync,realpathSync,existsSync,mkdirSync} from 'node:fs';
import {join,resolve,dirname,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {verifyCoreBundle,sealCoreBundle} from './core-bundle.mjs';
import {verifyBackendPackage} from './backend-package.mjs';

export const KB_UPGRADE_SOURCE='85a0f5c5e7b5155b1593e04baaebd534322d8cb2b41d2847e394e54a5ad75135';
export const KB_UPGRADE_TARGET='55d56847c17af69fe4616613cb46e0cdc3ae263f9d7a205f267290c504a94669';
const oldHelper='6b715b6aa1c293b8378512ca010ccdf5f5553d26a414109c8e1e8ba2d86fdfc1';
const sha=b=>createHash('sha256').update(b).digest('hex');

// Upgrade a COPY of the exact deployed private core, never the old source tree.
// The refreshed Hub files are handled separately by refreshBackendHub.
export function upgradeFrozenKnowledgeCore({source,output}){
 source=realpathSync(resolve(source));output=join(realpathSync(dirname(resolve(output))),basename(resolve(output)));
 if(existsSync(output)||output===source||output.startsWith(source+'/')||source.startsWith(output+'/'))throw Error('KB_CORE_UPGRADE_OUTPUT_REJECTED');
 const release=verifyBackendPackage(source);
 if(release.coreDigest!==KB_UPGRADE_SOURCE)throw Error('KB_CORE_UPGRADE_BASELINE_REJECTED');
 const files=verifyCoreBundle(join(source,'core'),KB_UPGRADE_SOURCE).files;
 const save=(name,bytes)=>{const target=join(output,name);mkdirSync(dirname(target),{recursive:true,mode:0o700});writeFileSync(target,bytes,{mode:0o600});};
 for(const f of files)save('core/'+f.path,readFileSync(join(source,'core',f.path)));
 save('core/core-manifest.json',readFileSync(join(source,'core/core-manifest.json')));
 for(const f of release.hubFiles)save('hub/'+f.path,readFileSync(join(source,'hub',f.path)));
 for(const name of ['release.json','Dockerfile','.dockerignore'])save(name,readFileSync(join(source,name)));
 const context=output,root=join(context,'core');verifyCoreBundle(root,KB_UPGRADE_SOURCE);
 const helper='src/common/hub-knowledge-admin.ts',metadata='prisma/runtime-adaptations/knowledge-admin.json';
 if(sha(readFileSync(join(root,helper)))!==oldHelper)throw Error('KB_CORE_UPGRADE_HELPER_DRIFT');
 const next=readFileSync(new URL('./runtime-adaptations/hub-knowledge-admin.ts',import.meta.url));
 const manifest=JSON.parse(readFileSync(join(root,metadata),'utf8'));
 if(manifest.added?.path!==helper||manifest.added.sha256!==oldHelper)throw Error('KB_CORE_UPGRADE_METADATA_DRIFT');
 manifest.scope.chatContexts=['hub','kb'];
 manifest.added={...manifest.added,sha256:sha(next),previousSha256:oldHelper};
 manifest.upgrade={kind:'k01-current-visible-kb-parent',sourceCoreDigest:KB_UPGRADE_SOURCE,sourceUnchanged:true};
 writeFileSync(join(root,helper),next,{mode:0o600});
 writeFileSync(join(root,metadata),JSON.stringify(manifest,null,2)+'\n',{mode:0o600});
 const sealed=sealCoreBundle(root);
 if(sealed.digest!==KB_UPGRADE_TARGET)throw Error('KB_CORE_UPGRADE_DIGEST_REAPPROVAL_REQUIRED');
 const result={...release,coreDigest:sealed.digest,compatibleHubCoreDigest:KB_UPGRADE_SOURCE,adaptations:[...release.adaptations,'k01-current-visible-kb-parent']};
 writeFileSync(join(context,'release.json'),JSON.stringify(result,null,2)+'\n',{mode:0o600});
 verifyBackendPackage(context);return result;
}
