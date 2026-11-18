import assert from 'node:assert/strict';
// Exact four cases approved on 2026-11-14. Historical WP09 jobs are not reused.
export function assetDetailAiCases(ids){
 for(const k of ['tenant','group','project','owner','admin'])assert.equal(ids[k],'rh-kb-local-b0e2af9d-'+k,'A02_NAMED_SCOPE_ONLY');
 return[
  {key:'owner-compare',accountId:ids.owner,sourceId:'cmwf3uk5i000aluiv3x1z1qae',sourceVersion:1,targetId:'cmwf3v8jn000yluiv9qocchuu',targetVersion:2,intent:'compare'},
  {key:'admin-compare',accountId:ids.admin,sourceId:'cmwf40tiy001elurqx5n6es06',sourceVersion:1,targetId:'cmwf41her002olurqa9d2308r',targetVersion:2,intent:'compare'},
  {key:'general-explain',accountId:ids.admin,sourceId:'cmwf411h5001qlurqida3stv7',sourceVersion:1,targetId:null,targetVersion:null,intent:'explain'},
  {key:'revoke-inflight',accountId:ids.owner,sourceId:'cmwewkt4d0021luy3207ld7x0',sourceVersion:3,targetId:'cmwf40j3y0012lurq32n4j525',targetVersion:1,intent:'compare'},
 ].map(c=>({...c,requestKey:'rh-asset-detail-ai-20261114-'+c.key}));
}
export function assertAssetDetailAiCase(cases,user,input){
 assert(input&&Object.keys(input).sort().join(',')==='basisHash,caseKey,requestKey','A02_AI_INPUT_INVALID');
 const c=cases.find(x=>x.key===input.caseKey&&x.accountId===user.accountId);
 assert(c&&input.requestKey===c.requestKey&&/^[a-f0-9]{64}$/.test(input.basisHash),'A02_AI_NAMED_CASE_REQUIRED');return c;
}
