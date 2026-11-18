import {catalogError} from '../../scripts/research-assets-catalog-contract.mjs';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
// Scope parsing is not authorization. Each routed service still takes the
// current tenant/official lock and checks current account, parent and rights.
export function assetHttpScopedUser(req){
 if(!req.user||!id(req.user.accountId))throw catalogError('AUTHORIZATION_REVOKED',401,'请先登录后重新读取。');
 const studyGroupId=req.headers?.['x-study-group-id'],researchProjectId=req.headers?.['x-research-project-id'];
 if(!id(studyGroupId)||!id(researchProjectId))throw catalogError('INPUT_INVALID',400,'请从已授权研究重新打开资产操作。');
 return{...req.user,studyGroupId,researchProjectId};
}
