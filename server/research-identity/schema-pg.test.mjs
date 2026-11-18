import test from 'node:test';
import assert from 'node:assert/strict';
import {loadFixtureInput} from '../../../app/server/scripts/wp01/local-config.mjs';
import {withFixtureTransaction} from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import {applyResearchIdentitySchema,inspectResearchIdentitySchema} from '../../scripts/research-identity-schema.mjs';

const {env}=loadFixtureInput(new URL('../../../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json',import.meta.url).pathname);
const tenant='rh-kb-local-b0e2af9d-tenant';
const preserved=()=>withFixtureTransaction(env,'direct',async tx=>(await tx.$queryRaw`SELECT md5(jsonb_agg(to_jsonb(a)-'researchProfile'-'researchProfileVersion'-'researchProfileEstablishedAt'-'researchProfileLastMutation' ORDER BY id)::text) hash FROM public.account a WHERE "tenantId"=${tenant} AND id IN ('rh-kb-local-b0e2af9d-owner','rh-kb-local-b0e2af9d-admin')`)[0].hash,{readOnly:true});
test('real guarded migration preserves legacy account values, is reentrant and retains tenant RLS',async()=>{
  const before=await preserved(),initial=await inspectResearchIdentitySchema(env);
  const first=await applyResearchIdentitySchema(env);
  assert.equal(first.created,initial.columns.length===0);
  assert.equal((await applyResearchIdentitySchema(env)).created,false);
  assert.equal(await preserved(),before);
  await withFixtureTransaction(env,'app',async tx=>{
    await tx.$executeRaw`SELECT set_config('app.tenant_id',${tenant},true)`;
    const rows=await tx.$queryRaw`SELECT "researchProfile","researchProfileVersion","researchProfileEstablishedAt","researchProfileLastMutation" FROM public.account WHERE id='rh-kb-local-b0e2af9d-owner'`;
    assert.equal(rows.length,1);
    if(!initial.columns.length)assert.deepEqual(rows[0],{researchProfile:null,researchProfileVersion:null,researchProfileEstablishedAt:null,researchProfileLastMutation:null});
    await tx.$executeRaw`SELECT set_config('app.tenant_id','identity-no-such-tenant',true)`;
    assert.equal((await tx.$queryRaw`SELECT id FROM public.account WHERE id='rh-kb-local-b0e2af9d-owner'`).length,0);
  },{readOnly:true});
});
