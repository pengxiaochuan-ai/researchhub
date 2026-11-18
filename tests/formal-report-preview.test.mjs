import test from 'node:test';
import assert from 'node:assert/strict';
import * as reports from '../src/formal-reports-session.js';
import {preview} from './fixtures/formal-report-preview.mjs';
for(const full of [false,true])test('WF09 verifies exact '+(full?'group':'run')+' preview, body digest and source digest before exposing save',async()=>{
 assert.equal(typeof reports.verifiedReportPreview,'function');const p=preview(full),scope={studyId:'study',...(full?{runGroupId:'group-run'}:{runId:'run'})};assert(await reports.verifiedReportPreview(p,scope));
 for(const changed of [{studyId:'other'},{contentMd:p.contentMd+'tampered'},{previewHash:'0'.repeat(64)},{sourceSnapshotHash:'c'.repeat(64)},{status:'released'},{artifactId:'rh-formal-report-injected'},full?{runId:'run'}:{runGroupId:'group-run'}])assert.equal(await reports.verifiedReportPreview({...p,...changed},scope),false,JSON.stringify(changed));
 assert.equal(await reports.verifiedReportPreview(p,{...scope,...(full?{runGroupId:'other'}:{runId:'other'})}),false);
});

test('WF09 creating a fixed report requires its current verified preview and exact source even with create permission',()=>{const p=preview(),base={capabilities:p.capabilities,sourceCurrent:true,run:{id:'run',status:'completed',reviewStatus:'confirmed'},preview:p};assert(reports.canReportAction('create',base));for(const change of [{preview:null},{preview:{...p,runId:'other'}},{sourceCurrent:false},{run:{...base.run,reviewStatus:'pending_review'}}])assert.equal(reports.canReportAction('create',{...base,...change}),false);});
