// Prepared for root review. This file has NOT been executed by its author.
// Explicit execution: node scripts/research-t18-main-capture.mjs --local-synthetic --execute-main-capture
// Main benchmark capture/review only. No correction, invitation, H5 answer write, analysis or report run.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash, randomUUID} from 'node:crypto';
import {workspaceRoot, fixtureEnvironment} from './research-creation-fixture.mjs';
import {assertFixtureTarget} from '../../app/server/scripts/wp01/fixture-guard.mjs';

assert.deepEqual(process.argv.slice(2), ['--local-synthetic', '--execute-main-capture']);
const base = 'http://127.0.0.1:19501';
const oraclePath = workspaceRoot + 'researchhub/docs/testing/fixtures/research-study/generic-v2/oracle.json';
const h5Path = workspaceRoot + 'researchhub/docs/testing/fixtures/research-study/generic-v2/h5-source.json';
const hash = value => createHash('sha256').update(value).digest('hex');
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const oracleBytes = readFileSync(oraclePath), oracleSha256 = hash(oracleBytes);
assert.equal(oracleSha256, 'f0dafb552f6ffc43340a61c11c2fe7abc661cc15059a9b7a43b26d5fb8737f3b');
const oracle = JSON.parse(oracleBytes), h5Source = readJson(h5Path);
assert.equal(hash(readFileSync(h5Path)), oracle.h5EvidenceSha256);
assert.equal(oracle.schemaVersion, 'generic-workflow-oracle-v2');
assert(oracle.syntheticOnly && h5Source.syntheticOnly);
const benchmarkPointer = readJson(workspaceRoot + '.tmp/researchhub-workflow/benchmark-current.json');
const benchmark = readJson(benchmarkPointer.acceptedFile);
assert(benchmark.passed && benchmark.syntheticOnly);
assert.equal(benchmark.runId, 'rh-workflow-benchmark-747c689d');
assert.equal(h5Source.studyId, benchmark.study.id);
assert.equal(h5Source.visitId, benchmark.cases.H5.visitId);
assert.equal(h5Source.invitation.studyId, benchmark.study.id);
assert.equal(h5Source.invitation.visitId, benchmark.cases.H5.visitId);
const expected = Object.fromEntries(oracle.rows.map(row => [row.case.toUpperCase(), row]));
assert.deepEqual(Object.keys(expected).sort(), ['CSV', 'H5', 'ONSITE']);
assert.deepEqual(expected.H5.answers, h5Source.submittedAnswers);
const names = ['ONSITE', 'CSV', 'H5'];
assert.deepEqual([...benchmark.analysisSubjectIds].sort(), names.map(name => benchmark.cases[name].subject.id).sort());
for (const name of names) assert(benchmark.cases[name].subject.subjectId.startsWith('SYNTHETIC-' + name + '-747c689d'));

const apiRoot = '/research-studies/' + benchmark.study.id;
const runId = 'main-capture-' + randomUUID().slice(0, 8);
const out = workspaceRoot + 'researchhub/docs/testing/evidence/research-t18-2026-11-12/' + runId + '/';
const statePath = workspaceRoot + '.tmp/researchhub-workflow/t18-main-capture-state.json';
const journal = existsSync(statePath) ? readJson(statePath) : {studyId: benchmark.study.id, oracleSha256, pending: null, history: []};
assert.equal(journal.studyId, benchmark.study.id);
assert.equal(journal.oracleSha256, oracleSha256);
assert(Array.isArray(journal.history));
const checks = [], network = [], responses = [], pageErrors = [], guardErrors = [], pages = [];
let stage = 'target-preflight', browser, context, armed = null, h5Original;
const responseJobs = new Set();
const save = (filename, value) => writeFileSync(out + filename, JSON.stringify(value, null, 2) + '\n', {mode: 0o600});
const saveJournal = () => writeFileSync(statePath, JSON.stringify(journal, null, 2) + '\n', {mode: 0o600});
const url = (visitId, assignmentId) => base + '/pages/s09/?' + new URLSearchParams({formalCapture: '1', studyId: benchmark.study.id, ...(visitId ? {visitId} : {}), ...(assignmentId ? {assignmentId} : {})}) + (visitId ? '' : '#csv-import');
const matches = (actual, wanted) => {try {assert.deepEqual(actual, wanted); return true;} catch {return false;}};
const normalizedAnswers = (name, answers) => {
  const value = structuredClone(answers);
  // The shared CSV importer records explicit null for an empty optional cell.
  if (name === 'CSV' && value?.optional_value === null) delete value.optional_value;
  return value;
};

const cookie = readJson(workspaceRoot + '.tmp/researchhub-19501-integration/preflight-cookie.json').admin;
assert.equal(typeof cookie, 'string');
async function get(path, {allow404 = false} = {}) {
  const response = await fetch(base + '/api' + path, {headers: {Cookie: cookie}, redirect: 'error', signal: AbortSignal.timeout(20000)});
  const value = await response.json();
  network.push({at: new Date().toISOString(), stage, via: 'readonly-fetch', method: 'GET', path: '/api' + path, status: response.status, code: value?.code ?? null});
  if (allow404 && response.status === 404) return {notFound: true, response: value};
  assert.equal(response.status, 200, JSON.stringify({path, status: response.status, code: value?.code}));
  return value;
}
async function readVisit(name) {
  const sample = benchmark.cases[name], value = await get(apiRoot + '/visits/' + sample.visitId);
  assert.equal(value.studyId, benchmark.study.id);
  assert.equal(value.visit.id, sample.visitId);
  assert.equal(value.visit.subject.id, sample.subject.id);
  assert.equal(value.visit.subject.subjectId, sample.subject.subjectId);
  assert.equal(value.visit.protocolVersionId, benchmark.protocolId);
  assert.equal(value.visit.visitPlan.code, expected[name].visitCode);
  const requirements = value.visit.visitPlan.requirements.filter(row => row.kind === 'form_response' && row.config?.formVersionId === benchmark.refs.form);
  assert.equal(requirements.length, 1, 'MAIN_FIXED_FORM_REQUIREMENT_CHANGED');
  return value.visit;
}
async function findCapture(name) {
  const visit = await readVisit(name), assignments = visit.assignments.filter(row => row.formVersionId === benchmark.refs.form);
  assert(assignments.length <= 1, 'AMBIGUOUS_MAIN_ASSIGNMENT');
  if (!assignments.length) return null;
  const capture = await get(apiRoot + '/assignments/' + assignments[0].id);
  assert.equal(capture.studyId, benchmark.study.id);
  assert.equal(capture.assignment.subjectVisitId, visit.id);
  assert.equal(capture.assignment.subjectId, benchmark.cases[name].subject.id);
  assert.equal(capture.assignment.formVersion.id, benchmark.refs.form);
  return capture;
}
async function currentRevision(name) {
  const capture = await findCapture(name);
  assert(capture && capture.response.status === 'submitted' && capture.response.ref, name + '_CURRENT_SUBMISSION_REQUIRED');
  assert.equal(capture.response.legacyUnversioned, false);
  assert.equal(capture.response.ref.revisionNo, 1, name + '_MAIN_BASELINE_MUST_REMAIN_REVISION_ONE');
  assert.deepEqual(normalizedAnswers(name, capture.response.answers), expected[name].answers, name + '_ANSWERS_CHANGED');
  const ref = capture.response.ref;
  assert.equal(ref.assignmentId, capture.assignment.id);
  const revision = (await get(apiRoot + '/assignments/' + capture.assignment.id + '/revisions/' + ref.revisionNo + '?' + new URLSearchParams({responseId: ref.responseId, contentHash: ref.contentHash}))).revision;
  assert.deepEqual(revision.ref, ref);
  assert.equal(revision.formVersionId, benchmark.refs.form);
  assert.deepEqual(revision.answers, capture.response.answers);
  if (name === 'CSV') {
    // Revision source is the authorized capture actor; import channel lives in the immutable batch receipt.
    assert.equal(revision.source, 'researcher', 'CSV_CAPTURE_ACTOR_CHANGED');
    const original = journal.history.find(item => item.path === apiRoot + '/imports' && item.response?.rows?.some(row => row.assignmentId === capture.assignment.id));
    assert(original, 'CSV_ORIGINAL_IMPORT_RECEIPT_REQUIRED_DO_NOT_REIMPORT');
    const imported = await get(original.receiptPath), row = imported.rows.find(item => item.assignmentId === capture.assignment.id);
    const bytes = 'subject_code,visit_code,value,optional_value,completed\r\n' + benchmark.cases.CSV.subject.subjectId + ',BASELINE,4,,true\r\n';
    assert.equal(imported.source.kind, 'csv_import'); assert.equal(imported.source.csvSha256, hash(bytes));
    assert.equal(row.subjectId, benchmark.cases.CSV.subject.id); assert.equal(row.visitId, benchmark.cases.CSV.visitId); assert.deepEqual(row.ref, ref);
    return {capture, revision, importSource: {source: imported.source, row, receipt: imported.receipt}};
  }
  assert.equal(revision.source, expected[name].source, name + '_SOURCE_CHANGED');
  return {capture, revision};
}
async function checkH5() {
  const current = await currentRevision('H5');
  assert.equal(current.capture.assignment.id, h5Source.invitation.assignmentId);
  assert.equal(current.capture.assignment.mode, 'patient_h5');
  const immutable = {ref: current.revision.ref, answers: current.revision.answers, source: current.revision.source, actorKind: current.revision.actorKind, actorId: current.revision.actorId, sourceSubmittedAt: current.revision.sourceSubmittedAt, createdAt: current.revision.createdAt};
  assert.equal(immutable.actorKind, 'h5_session');
  if (h5Original) assert.deepEqual(immutable, h5Original, 'ORIGINAL_H5_IMMUTABLE_FACTS_CHANGED');
  else {h5Original = immutable; if (journal.h5Original) assert.deepEqual(immutable, journal.h5Original); else {journal.h5Original = immutable; saveJournal();}}
  return current;
}
async function ready(page) {
  await page.waitForFunction(() => {const main = document.querySelector('main.rh-formal-capture'); return main && main.getAttribute('aria-busy') === 'false' && !main.textContent.includes('正在读取当前研究');});
  assert.equal(await page.getByRole('button', {name: '核对上次操作结果', exact: true}).count(), 0, 'UNKNOWN_UI_OPERATION_REQUIRES_ORIGINAL_RECEIPT_ONLY');
}
async function newPage(name, target) {
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', error => pageErrors.push({stage, name, message: error.message}));
  page.on('dialog', async dialog => {pageErrors.push({stage, name, message: 'Unexpected native dialog: ' + dialog.type()}); await dialog.dismiss();});
  page.on('response', response => {
    const request = response.request(), parsed = new URL(response.url());
    if (!parsed.pathname.startsWith('/api/')) return;
    const entry = {at: new Date().toISOString(), stage, via: 'browser', page: name, method: request.method(), path: parsed.pathname + parsed.search, status: response.status()};
    network.push(entry);
    if (request.method() === 'POST' && parsed.pathname.startsWith('/api' + apiRoot)) {
      const job = response.json().then(value => {responses.push({...entry, request: request.postDataJSON(), response: value});}).catch(() => {entry.responseBodyUnavailable = true;});
      responseJobs.add(job); job.finally(() => responseJobs.delete(job));
    }
  });
  pages.push({name, page});
  await page.goto(target);
  await ready(page);
  return page;
}
async function captureWrite(page, {path, receiptPath, validate}, click) {
  await checkH5();
  // Quiesce this page's legitimate current-authority reads before a deliberate UI action.
  await page.waitForLoadState('networkidle');
  assert.equal(journal.pending, null, 'PENDING_WRITE_FORBIDS_NEW_MUTATION');
  armed = {path: '/api' + path, receiptPath, validate, used: false};
  const responsePromise = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api' + path);
  responsePromise.catch(() => {}); // A failed click must not leave an unhandled timeout promise.
  try {
    await click();
    const response = await responsePromise, value = await response.json();
    assert.equal(response.status(), 200, JSON.stringify({path, status: response.status(), code: value?.code}));
    assert(armed.used && journal.pending, 'WRITE_INTENT_WAS_NOT_JOURNALED');
    const pending = journal.pending;
    assert.equal(value.studyId, benchmark.study.id);
    assert.equal(value.receipt?.requestKey, pending.requestKey);
    const receipt = await get(pending.receiptPath);
    assert.equal(receipt.studyId, benchmark.study.id);
    assert.equal(receipt.receipt?.requestKey, pending.requestKey);
    assert.deepEqual(receipt, value, 'ORIGINAL_WRITE_RECEIPT_CHANGED');
    journal.history.push({...pending, confirmedAt: new Date().toISOString(), response: value});
    journal.pending = null; saveJournal();
    await checkH5();
    return value;
  } finally {armed = null;}
}
async function confirmWrite(page, button, command) {
  await page.getByRole('button', {name: button, exact: true}).click();
  const dialog = page.getByRole('dialog'); await dialog.waitFor();
  const result = await captureWrite(page, command, () => dialog.getByRole('button', {name: '确认', exact: true}).click());
  await page.getByText('已保存并核对当前状态。', {exact: true}).waitFor();
  await ready(page);
  return result;
}
async function reviewPanel(page) {
  if (!await page.locator('details.fc-review').evaluate(element => element.open)) await page.getByText('更正与审阅', {exact: true}).click();
}
const commandBody = (body, version, ref) => {
  assert.equal(typeof body.requestKey, 'string');
  assert.equal(body.expectedVersion, version);
  if (ref) assert.deepEqual(body.expectedRef, ref);
};

try {
  assert.equal((await assertFixtureTarget(fixtureEnvironment())).databaseName, 'wp01_test_full_baseline');
  mkdirSync(out, {recursive: true});
  save('inputs.json', {benchmarkFile: benchmarkPointer.acceptedFile, oraclePath, oracleSha256, h5Path, h5EvidenceSha256: oracle.h5EvidenceSha256, syntheticOnly: true, names, studyId: benchmark.study.id});
  const me = await get('/auth/me');
  assert.equal(me.tenantId, benchmark.scope.tenantId);
  assert.equal(me.role, 'tenant_admin'); assert.equal(me.isTenantAdmin, true);
  save('actor.json', {accountId: me.accountId, tenantId: me.tenantId, role: me.role, isTenantAdmin: me.isTenantAdmin, authVersion: me.authVersion});
  // A previous in-flight write is never replayed, even when its receipt now exists.
  if (journal.pending) {
    stage = 'previous-unknown-receipt-read-only';
    const receipt = await get(journal.pending.receiptPath, {allow404: true});
    save('previous-unknown-recovery.json', {pending: journal.pending, receipt, newBusinessWrites: 0});
    if (!receipt.notFound) {
      assert.equal(receipt.receipt?.requestKey, journal.pending.requestKey);
      journal.history.push({...journal.pending, recoveredReadOnlyAt: new Date().toISOString(), receipt});
      journal.pending = null; saveJournal();
    }
    throw Error('PREVIOUS_UNKNOWN_OPERATION_READ_ONLY_CHECKED_STOP_FOR_ROOT_REVIEW');
  }
  await checkH5();
  save('h5-original.json', h5Original);
  const original = {};
  for (const name of names) {
    const capture = await findCapture(name);
    original[name] = {visit: await readVisit(name), capture};
    if (capture?.response.status === 'submitted') await currentRevision(name);
    else if (capture) {
      assert.equal(name === 'H5', false, 'H5_MUST_ALREADY_BE_SUBMITTED');
      assert.equal(capture.response.status, 'draft');
      assert.equal(capture.response.ref, null);
      assert.equal(capture.response.locked, false);
      assert(Object.keys(capture.response.answers ?? {}).length === 0 || name === 'ONSITE' && matches(capture.response.answers, expected.ONSITE.answers), name + '_EXISTING_DRAFT_DIFFERS_STOP_WITHOUT_OVERWRITE');
    }
  }
  save('before.json', original); saveJournal();
  checks.push('all_three_main_parent_chains_and_prior_values_verified_before_any_business_write');

  const {chromium} = createRequire(workspaceRoot + 'app/package.json')('./node_modules/.pnpm/playwright@1.63.0/node_modules/playwright');
  browser = await chromium.launch({headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  context = await browser.newContext({viewport: {width: 1440, height: 1000}, recordVideo: {dir: out + 'video'}});
  const separator = cookie.indexOf('=');
  await context.addCookies([{name: cookie.slice(0, separator), value: cookie.slice(separator + 1), domain: '127.0.0.1', path: '/api', httpOnly: true, sameSite: 'Lax'}]);
  // Request gate only: normal responses are never mocked, fulfilled or changed.
  await context.route('**/api/**', async route => {
    const request = route.request(), parsed = new URL(request.url()), path = parsed.pathname;
    try {
      assert.equal(parsed.origin, base);
      if (request.method() === 'GET' || request.method() === 'POST' && path === '/api/auth/renew') return await route.continue();
      assert(armed && !armed.used && request.method() === 'POST' && path === armed.path, 'UNARMED_BUSINESS_WRITE_BLOCKED');
      const body = request.postDataJSON(); armed.validate(body); armed.used = true;
      if (armed.receiptPath) {
        assert.equal(journal.pending, null);
        assert.equal(typeof body.requestKey, 'string');
        journal.pending = {runId, stage, at: new Date().toISOString(), path: path.slice(4), requestKey: body.requestKey, body, receiptPath: armed.receiptPath(body.requestKey)};
        saveJournal(); // Durable original intent before the real browser POST proceeds.
      }
      await route.continue();
    } catch (error) {guardErrors.push({stage, method: request.method(), path, message: error.message}); await route.abort('blockedbyclient');}
  });

  stage = 'onsite-page-capture';
  let onsite = await findCapture('ONSITE');
  const onsitePage = await newPage('onsite', url(benchmark.cases.ONSITE.visitId, onsite?.assignment.id));
  if (!onsite) {
    const visit = await readVisit('ONSITE'); assert(visit.capabilities.canAssign);
    const requirement = visit.visitPlan.requirements.find(row => row.kind === 'form_response' && row.config?.formVersionId === benchmark.refs.form);
    const assigned = await captureWrite(onsitePage, {path: apiRoot + '/visits/' + visit.id + '/assignments', receiptPath: key => apiRoot + '/visits/' + visit.id + '/assignment-receipts/' + key, validate: body => assert.equal(body.formVersionId, benchmark.refs.form)}, () => onsitePage.getByRole('button', {name: '填写' + requirement.name, exact: true}).click());
    await onsitePage.waitForURL('**assignmentId=' + assigned.result.id);
    await ready(onsitePage); onsite = await findCapture('ONSITE');
  }
  if (onsite.response.status === 'draft') {
    assert(onsite.capabilities.canSubmit);
    const fields = onsite.assignment.formVersion.schema.fields;
    for (const [key, value] of Object.entries(expected.ONSITE.answers)) {
      const index = fields.findIndex(field => field.key === key); assert(index >= 0);
      const input = onsitePage.locator('#fc-field-' + index);
      if (typeof value === 'boolean') await input.selectOption(String(value)); else await input.fill(String(value));
    }
    await onsitePage.screenshot({path: out + 'onsite-zero-false-before-submit.png', fullPage: true});
    await confirmWrite(onsitePage, '提交表单', {path: apiRoot + '/assignments/' + onsite.assignment.id + '/submit', receiptPath: key => apiRoot + '/assignments/' + onsite.assignment.id + '/receipts/' + key + '?operation=submit', validate: body => {commandBody(body, onsite.response.version); assert.deepEqual(body.answers, expected.ONSITE.answers);}});
    checks.push('onsite_actual_s09_input_zero_optional_zero_false_and_shared_confirmation_submit');
  } else checks.push('onsite_existing_same_values_researcher_source_submission_preserved_without_resubmit');
  await currentRevision('ONSITE');
  await onsitePage.screenshot({path: out + 'onsite-submitted.png', fullPage: true});

  stage = 'csv-page-capture';
  const csvCurrent = await findCapture('CSV');
  if (csvCurrent?.response.status === 'submitted') {
    await currentRevision('CSV'); checks.push('csv_existing_same_values_import_source_submission_preserved_without_reimport');
  } else {
    const csvPage = await newPage('csv-import', url());
    await csvPage.getByLabel('CSV内容', {exact: true}).waitFor();
    await csvPage.getByLabel('固定表单版本', {exact: true}).selectOption(benchmark.refs.form);
    const csv = 'subject_code,visit_code,value,optional_value,completed\r\n' + benchmark.cases.CSV.subject.subjectId + ',BASELINE,4,,true\r\n';
    writeFileSync(out + 'main-csv.csv', csv);
    await csvPage.getByLabel('选择CSV文件', {exact: true}).setInputFiles({name: 'synthetic-main.csv', mimeType: 'text/csv', buffer: Buffer.from(csv)});
    assert.equal(await csvPage.getByLabel('CSV内容', {exact: true}).inputValue(), csv.replace(/\r\n/g, '\n'));
    armed = {path: '/api' + apiRoot + '/imports/preview', used: false, validate: body => {assert.equal(body.formVersionId, benchmark.refs.form); assert.equal(body.csv, csv);}};
    const previewResponse = csvPage.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api' + apiRoot + '/imports/preview');
    previewResponse.catch(() => {});
    let preview;
    try {await csvPage.getByRole('button', {name: '预检导入内容', exact: true}).click(); const response = await previewResponse; assert.equal(response.status(), 200); preview = await response.json(); assert(armed.used);} finally {armed = null;}
    assert.deepEqual(preview.errors, []); assert.equal(preview.rows.length, 1);
    assert.equal(preview.rows[0].subjectCode, benchmark.cases.CSV.subject.subjectId);
    assert.equal(preview.rows[0].visitCode, 'BASELINE');
    assert.deepEqual(normalizedAnswers('CSV', preview.rows[0].answers), expected.CSV.answers);
    await csvPage.getByRole('heading', {name: '预检通过，请核对内容', exact: true}).waitFor();
    await csvPage.screenshot({path: out + 'csv-real-file-preview.png', fullPage: true});
    await csvPage.getByRole('button', {name: '确认导入本批内容', exact: true}).click();
    const result = await captureWrite(csvPage, {path: apiRoot + '/imports', receiptPath: key => apiRoot + '/imports/receipts/' + key, validate: body => {assert.equal(body.formVersionId, benchmark.refs.form); assert.equal(body.csv, csv); assert.equal(body.previewHash, preview.previewHash);}}, () => csvPage.getByRole('dialog').getByRole('button', {name: '确认导入', exact: true}).click());
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].visitId, benchmark.cases.CSV.visitId);
    assert.equal(result.rows[0].subjectId, benchmark.cases.CSV.subject.id);
    assert.equal(result.source.kind, 'csv_import'); assert.equal(result.source.csvSha256, hash(csv));
    await csvPage.locator('.fc-import-result').waitFor();
    await csvPage.screenshot({path: out + 'csv-imported-original-ref.png', fullPage: true});
    checks.push('csv_actual_s09_file_preview_shared_confirmation_four_optional_missing_true_import');
  }
  await currentRevision('CSV');
  await checkH5(); checks.push('original_h5_one_point_five_two_true_source_and_revision_one_preserved');

  const final = {};
  for (const name of names) {
    stage = name.toLowerCase() + '-review-lock-complete';
    let current = await currentRevision(name);
    const ref = current.capture.response.ref, assignmentId = current.capture.assignment.id, visitId = benchmark.cases[name].visitId;
    const page = await newPage(name.toLowerCase() + '-review', url(visitId, assignmentId));
    let visit = await readVisit(name);
    if (visit.capabilities.canStart) {
      await captureWrite(page, {path: apiRoot + '/visits/' + visitId + '/start', receiptPath: key => apiRoot + '/visits/' + visitId + '/receipts/' + key + '?operation=start', validate: body => commandBody(body, visit.version)}, () => page.getByRole('button', {name: '开始访视', exact: true}).click());
      await page.getByText('已保存并核对当前状态。', {exact: true}).waitFor(); await ready(page);
    }
    current = await currentRevision(name);
    if (current.capture.response.review !== 'review_approved') {
      assert(current.capture.capabilities.canReview, name + '_CURRENT_REVIEW_UNAVAILABLE');
      await reviewPanel(page);
      await confirmWrite(page, '审核通过', {path: apiRoot + '/assignments/' + assignmentId + '/review', receiptPath: key => apiRoot + '/assignments/' + assignmentId + '/receipts/' + key + '?operation=review', validate: body => {commandBody(body, current.capture.response.version, ref); assert.equal(body.decision, 'approved');}});
    }
    current = await currentRevision(name); assert.deepEqual(current.capture.response.ref, ref);
    if (!current.capture.response.locked) {
      assert(current.capture.capabilities.canLock, name + '_CURRENT_LOCK_UNAVAILABLE');
      await reviewPanel(page);
      await confirmWrite(page, '锁定表单', {path: apiRoot + '/assignments/' + assignmentId + '/lock', receiptPath: key => apiRoot + '/assignments/' + assignmentId + '/receipts/' + key + '?operation=lock', validate: body => commandBody(body, current.capture.response.version, ref)});
    }
    visit = await readVisit(name);
    if (visit.status !== 'completed') {
      assert(visit.capabilities.canComplete, name + '_CURRENT_COMPLETION_UNAVAILABLE');
      await confirmWrite(page, '完成访视', {path: apiRoot + '/visits/' + visitId + '/complete', receiptPath: key => apiRoot + '/visits/' + visitId + '/receipts/' + key + '?operation=complete', validate: body => commandBody(body, visit.version)});
    }
    current = await currentRevision(name); visit = await readVisit(name);
    assert.deepEqual(current.capture.response.ref, ref);
    assert.equal(current.capture.response.review, 'review_approved'); assert.equal(current.capture.response.locked, true);
    assert.equal(visit.status, 'completed'); assert.equal(visit.completionIntegrity, 'current'); assert(visit.actualCompletedAt);
    const requirement = visit.visitPlan.requirements.find(row => row.kind === 'form_response' && row.config?.formVersionId === benchmark.refs.form);
    const fulfillment = visit.fulfillments.find(row => row.visitRequirementId === requirement.id);
    assert(fulfillment?.evidenceRefs.some(row => row.type === 'formal_response_revision' && Object.entries(ref).every(([key, value]) => row[key] === value)), name + '_VISIT_CURRENT_FIXED_RESPONSE_REF_MISSING');
    final[name] = {subject: benchmark.cases[name].subject, visit, capture: current.capture, revision: current.revision, ...(current.importSource ? {importSource: current.importSource} : {})};
    save('progress.json', {at: new Date().toISOString(), stage, h5Original, completed: final, checks, network, responses, pending: journal.pending});
    await page.screenshot({path: out + name.toLowerCase() + '-approved-locked-completed.png', fullPage: true});
    checks.push(name.toLowerCase() + '_actual_current_revision_approved_locked_and_visit_completed_without_answer_change');
  }
  await checkH5(); assert.equal(journal.pending, null); assert.deepEqual(pageErrors, []); assert.deepEqual(guardErrors, []);
  await Promise.allSettled([...responseJobs]);
  const result = {passed: true, at: new Date().toISOString(), runId, syntheticOnly: true, studyId: benchmark.study.id, oracleSha256, h5Original, final, checks, network, responses, pageErrors, guardErrors, pending: journal.pending, browserAcceptance: true, clinicalAcceptance: false, productionAcceptance: false, analysisAndReportAcceptance: false, noCorrectionPerformed: true};
  save('result.json', result);
  writeFileSync(workspaceRoot + '.tmp/researchhub-workflow/t18-main-capture-current.json', JSON.stringify({acceptedFile: out + 'result.json'}) + '\n', {mode: 0o600});
  console.log(JSON.stringify({passed: true, evidence: out + 'result.json', checks}));
} catch (error) {
  if (existsSync(out)) {
    await Promise.allSettled([...responseJobs]);
    save('failure.json', {passed: false, at: new Date().toISOString(), stage, message: error.message, h5Original, checks, network, responses, pageErrors, guardErrors, pending: journal.pending, automaticReplayAttempted: false});
    for (const {name, page} of pages) {await page.screenshot({path: out + 'failure-' + name + '.png', fullPage: true}).catch(() => {});writeFileSync(out + 'failure-' + name + '.txt', await page.locator('main').innerText().catch(() => 'unavailable'));}
  }
  console.error(JSON.stringify({passed: false, stage, message: error.message, evidence: existsSync(out) ? out + 'failure.json' : null}));
  process.exitCode = 1;
} finally {await context?.close(); await browser?.close();}
