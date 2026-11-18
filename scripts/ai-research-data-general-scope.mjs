const deny=()=>{throw Object.assign(Error('DATA_IMPORT_OBJECT_FORBIDDEN'),{code:'DATA_IMPORT_OBJECT_FORBIDDEN',status:403});};
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(v);
export function validateGeneralUnitScope(c,ids){
 if(c?.schema!=='hub-general-unit-local-scope.v1'||c.scopeKey!=='general-unit-20261113'||c.accounts?.owner!==ids.owner||c.accounts?.admin!==ids.admin||c.target?.studyGroupId!==ids.group||!id(c.target?.studyId)||!id(c.target?.executionProjectId)||c.sessions?.[ids.owner]!=='cmwevnq180005lu2arv5lqab9'||c.sessions?.[ids.admin]!=='cmwevnzrb000dlu2a2qm8k5ao'||c.expiresAt!=='2026-11-20T07:36:52.684Z')deny();
 const subjects=[],visits=[];
 for(const actor of [ids.owner,ids.admin]){const o=c.registeredObjects?.[actor];if(!o||!Array.isArray(o.subjectIds)||!Array.isArray(o.visitIds)||o.subjectIds.length!==2||o.visitIds.length!==2||[...o.subjectIds,...o.visitIds].some(v=>!id(v)))deny();subjects.push(...o.subjectIds);visits.push(...o.visitIds);}
 if(new Set(subjects).size!==4||new Set(visits).size!==4)deny();return c;
}
export function assertGeneralUnitRows(c,user,mapped){
 const actor=user.accountId===c.accounts.owner?'OWNER':user.accountId===c.accounts.admin?'ADMIN':null;
 const allowed=actor?[`GENERAL-UNIT-${actor}-A`,`GENERAL-UNIT-${actor}-B`]:[];
 if(mapped.mode!=='visit_form'||!mapped.rows.length||mapped.rows.length>2||mapped.rows.some(r=>!allowed.includes(r.subjectCode)))deny();
}
import {materialDigest} from '../server/ai-agent/session-material-contract.mjs';
export function assertGeneralUnitManifest(c,m){
 if(m?.purpose!=='general-unit-write-2026-11-13'||m.syntheticOnly!==true||m.scopeKey!==c.scopeKey||materialDigest(m.target)!==materialDigest(c.target)||!m.config||materialDigest(c)!==materialDigest(m.config))deny();
}
