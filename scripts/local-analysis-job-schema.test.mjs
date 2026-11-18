import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalExecutionJobSchemaCheck,executionJobMigrationId,executionJobMigrationHash} from './local-analysis-job-schema.mjs';

function fixture(){
 const h={calls:0,sql:[],marker:{syntheticOnly:true,sha256:executionJobMigrationHash,deploymentId:'deployment',tenantId:'tenant'},table:{rls:true,forceRls:true,owner:'aisci_owner'},candidate:{definer:true,owner:'rh_analysis_job_candidate_reader',configuration:['search_path=pg_catalog'],canLogin:false,superuser:false,bypassRls:false,inherit:false,memberships:0,executable:true},databaseError:null};
 const tx={$queryRaw:async(strings,...values)=>{const sql=strings.join('?');h.sql.push({sql,values});assert(sql.trimStart().startsWith('SELECT '));if(h.databaseError)throw h.databaseError;if(sql.includes('wp01_meta.fixture_run')){assert.equal(values[0],executionJobMigrationId);return h.marker?[{manifest:h.marker}]:[];}if(sql.includes('pg_class'))return h.table?[h.table]:[];if(sql.includes('pg_proc'))return h.candidate?[h.candidate]:[];throw Error('unexpected query');}};
 h.options={env:{explicitLocalFixture:true},tenantId:'tenant',deploymentScope:{deploymentId:'deployment',allowedTenantIds:['tenant']},transaction:async(env,kind,fn,options)=>{h.calls++;assert.equal(env,h.options.env);assert.equal(kind,'direct');assert.deepEqual(options,{readOnly:true});return fn(tx);}};
 h.check=()=>createLocalExecutionJobSchemaCheck(h.options)();return h;
}
test('local Job preflight verifies exact provisioning, forced RLS and bounded reader metadata using read-only SELECTs',async()=>{
 const h=fixture(),v=await h.check();assert.equal(v.ready,true);assert.equal(v.sha256,executionJobMigrationHash);assert.equal(h.calls,1);assert.equal(h.sql.length,3);assert(!JSON.stringify(v).includes('password'));
});
test('missing, cross-deployment or wrong-hash marker fails before touching execution tables',async()=>{
 for(const change of [h=>h.marker=null,h=>h.marker.sha256='b'.repeat(64),h=>h.marker.deploymentId='other',h=>h.marker.syntheticOnly=false]){const h=fixture();change(h);await assert.rejects(h.check(),e=>e.status===503&&e.code==='ANALYSIS_JOB_SCHEMA_NOT_PREPARED');assert.equal(h.sql.length,1);}
});
test('disabled RLS or privileged candidate reader cannot enable the local consumer',async()=>{
 for(const change of [h=>h.table.forceRls=false,h=>h.candidate.canLogin=true,h=>h.candidate.bypassRls=true,h=>h.candidate.inherit=true,h=>h.candidate.memberships=1,h=>h.candidate.configuration=['search_path=public'],h=>h.candidate.executable=false]){const h=fixture();change(h);await assert.rejects(h.check(),e=>e.status===503);}
});
test('a missing scope or changed migration source fails before any database connection',()=>{
 const h=fixture();for(const options of [{...h.options,tenantId:'other'},{...h.options,deploymentScope:{deploymentId:'deployment',allowedTenantIds:[]}},{...h.options,readMigration:()=>Buffer.from('different SQL')}])assert.throws(()=>createLocalExecutionJobSchemaCheck(options),e=>e.status===503);assert.equal(h.calls,0);
});
test('database failures return a safe unavailable message and never run provisioning DDL',async()=>{
 const h=fixture();h.databaseError=Error('PRIVATE_CONNECTION_OR_SQL_DETAIL');await assert.rejects(h.check(),e=>e.status===503&&!e.message.includes('PRIVATE_CONNECTION'));assert.equal(h.calls,1);assert.equal(h.sql.length,1);
});
