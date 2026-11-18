import assert from 'node:assert/strict';
import {RESEARCH_ASSET_KINDS} from '../../scripts/research-assets-read-contract.mjs';
export const LOCAL_ASSET_FIXTURE_PREFIX='rh-research-asset:local-20261112:';
export function assertNamedResearchAssetFixtures(rows,ids){
 const expected=new Map(['owner','admin'].flatMap(actor=>RESEARCH_ASSET_KINDS.map(kind=>[LOCAL_ASSET_FIXTURE_PREFIX+actor+':'+kind,ids[actor]])));
 assert.ok(rows.length<=10&&new Set(rows.map(r=>r.idempotencyKey)).size===rows.length,'ASSET_FIXTURE_SCOPE_REJECTED');
 for(const row of rows)assert.ok(expected.has(row.idempotencyKey)&&row.ownerAccountId===expected.get(row.idempotencyKey)&&row.createdBy===row.ownerAccountId&&
  row.tenantId===ids.tenant&&row.studyGroupId===ids.group&&row.researchProjectId===ids.project&&row.status==='draft'&&row.deletedAt===null&&[1,2].includes(row.currentVersionNo),'ASSET_FIXTURE_SCOPE_REJECTED');
 return rows.length;
}
