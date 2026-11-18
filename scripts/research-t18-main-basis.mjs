// Prepared only; author has NOT executed this script.
// Root-reviewed execution: node scripts/research-t18-main-basis.mjs --local-synthetic --execute-main-basis
// Creates/approves/releases only an exact main-three S05 basis. Never writes subjects/responses or runs analysis/reports.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {createHash, randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {workspaceRoot, fixtureEnvironment} from './research-creation-fixture.mjs';
import {assertFixtureTarget} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {syntheticPlanVersions, validAnalysisDefinition, validAnalysisPage, validAnalysisPlan, validAnalysisPreview, validAnalysisSnapshot, validAnalysisResult, displayAnalysisCell} from '../src/formal-analysis-session.js';

assert.deepEqual(process.argv.slice(2), ['--local-synthetic', '--execute-main-basis']);
const base = 'http://127.0.0.1:19501', readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const oraclePath = workspaceRoot + 'researchhub/docs/testing/fixtures/research-study/generic-v2/oracle.json';
const oracleBytes = readFileSync(oraclePath), oracleSha256 = hash(oracleBytes), oracle = JSON.parse(oracleBytes);
assert.equal(oracleSha256, 'f0dafb552f6ffc43340a61c11c2fe7abc661cc15059a9b7a43b26d5fb8737f3b');
assert(oracle.syntheticOnly && oracle.schemaVersion === 'generic-workflow-oracle-v2');
const benchmarkFile = readJson(workspaceRoot + '.tmp/researchhub-workflow/benchmark-current.json').acceptedFile;
const benchmark = readJson(benchmarkFile);
assert(benchmark.passed && benchmark.syntheticOnly && benchmark.runId === 'rh-workflow-benchmark-747c689d');
const captureFile = readJson(workspaceRoot + '.tmp/researchhub-workflow/t18-main-capture-current.json').acceptedFile;
const captureBytes = readFileSync(captureFile), captureSha256 = hash(captureBytes), captured = JSON.parse(captureBytes);
assert(captured.passed && captured.syntheticOnly && captured.pending === null && captured.noCorrectionPerformed);
assert.equal(captured.studyId, benchmark.study.id); assert.equal(captured.oracleSha256, oracleSha256);
const h5Path = workspaceRoot + 'researchhub/docs/testing/fixtures/research-study/generic-v2/h5-source.json';
assert.equal(hash(readFileSync(h5Path)), oracle.h5EvidenceSha256);
const h5Source = readJson(h5Path), names = ['ONSITE', 'CSV', 'H5'];
const expectedRows = Object.fromEntries(oracle.rows.map(row => [row.case.toUpperCase(), row]));
const subjectIds = names.map(name => benchmark.cases[name].subject.id);
assert.deepEqual([...subjectIds].sort(), [...benchmark.analysisSubjectIds].sort());
assert.deepEqual(captured.h5Original.ref, captured.final.H5.capture.response.ref);
assert.deepEqual(captured.h5Original.answers, h5Source.submittedAnswers);
assert.equal(captured.h5Original.ref.assignmentId, h5Source.invitation.assignmentId);
for (const name of names) {
  assert(benchmark.cases[name].subject.subjectId.startsWith('SYNTHETIC-' + name + '-747c689d'));
  assert.deepEqual(captured.final[name].subject, benchmark.cases[name].subject);
  assert.equal(captured.final[name].capture.response.ref.revisionNo, 1);
  assert(captured.final[name].capture.response.locked && captured.final[name].capture.response.review === 'review_approved');
  assert(captured.final[name].visit.status === 'completed' && captured.final[name].visit.completionIntegrity === 'current');
}
const freezePath = workspaceRoot + 'researchhub/docs/testing/evidence/research-t15-2026-11-12/ui-freeze/manifest.json';
const uiFreeze = readJson(freezePath);
assert.equal(uiFreeze.sources.length, 16);
for (const path of ['src/formal-analysis-session.js', 'pages/shared/useFormalAnalysis.js', 'pages/shared/FormalAnalysisWorkspace.jsx']) {
  const source = uiFreeze.sources.find(row => row.path === path); assert(source);
  assert.equal(hash(readFileSync(workspaceRoot + 'researchhub/' + path)), source.sha256, 'S05_FROZEN_SOURCE_CHANGED_REQUIRES_ROOT_REVIEW');
}

const apiRoot = '/research-studies/' + benchmark.study.id, analysisRoot = apiRoot + '/analysis';
const runId = 'main-basis-' + randomUUID().slice(0, 8);
const out = workspaceRoot + 'researchhub/docs/testing/evidence/research-t18-2026-11-12/' + runId + '/';
const statePath = workspaceRoot + '.tmp/researchhub-workflow/t18-main-basis-state.json';
const pointerPath = workspaceRoot + '.tmp/researchhub-workflow/t18-main-basis-current.json';
const journal = existsSync(statePath) ? readJson(statePath) : {studyId: benchmark.study.id, oracleSha256, captureSha256, pending: null, planId: null, snapshotId: null, history: []};
assert.equal(journal.studyId, benchmark.study.id); assert.equal(journal.oracleSha256, oracleSha256); assert.equal(journal.captureSha256, captureSha256); assert(Array.isArray(journal.history));
const cookie = readJson(workspaceRoot + '.tmp/researchhub-19501-integration/preflight-cookie.json').admin;
assert.equal(typeof cookie, 'string');
const network = [], responses = [], errors = [], guardErrors = [], checks = [], responseJobs = new Set();
let stage = 'preflight', browser, context, page, armed = null, definition, currentFacts, plan, snapshot, reused = false;
const save = (filename, value) => writeFileSync(out + filename, JSON.stringify(value, null, 2) + '\n', {mode: 0o600});
const saveJournal = () => writeFileSync(statePath, JSON.stringify(journal, null, 2) + '\n', {mode: 0o600});
const uiUrl = (planId, snapshotId) => base + '/pages/s05/?' + new URLSearchParams({formalAnalysis: '1', studyId: benchmark.study.id, ...(planId ? {planId} : {}), ...(snapshotId ? {snapshotId} : {})});
const receiptPath = (action, planId, requestKey) => analysisRoot + '/receipts/' + requestKey + '?' + new URLSearchParams({action: {submit: 'analysis.plan.submit', review: 'analysis.plan.review', release: 'analysis.release'}[action], targetId: action === 'submit' ? benchmark.study.id : planId});
const normalizeAnswers = (name, answers) => {const copy = structuredClone(answers); if (name === 'CSV' && copy.optional_value === null) delete copy.optional_value; return copy;};
const same = (left, right) => {try {assert.deepEqual(left, right); return true;} catch {return false;}};

async function get(path, {allow404 = false} = {}) {
  const response = await fetch(base + '/api' + path, {headers: {Cookie: cookie}, redirect: 'error', signal: AbortSignal.timeout(20000)});
  const value = await response.json();
  network.push({at: new Date().toISOString(), stage, via: 'readonly-fetch', method: 'GET', path: '/api' + path, status: response.status, code: value?.code ?? null});
  if (allow404 && response.status === 404) return {notFound: true, response: value};
  assert.equal(response.status, 200, JSON.stringify({path, status: response.status, code: value?.code}));
  return value;
}
async function assertMainFacts() {
  const facts = {};
  for (const name of names) {
    const original = captured.final[name], sample = benchmark.cases[name];
    const visit = (await get(apiRoot + '/visits/' + sample.visitId)).visit;
    assert.equal(visit.id, sample.visitId); assert.deepEqual(visit.subject, sample.subject);
    assert.equal(visit.protocolVersionId, benchmark.protocolId); assert.equal(visit.visitPlan.code, 'BASELINE');
    assert.equal(visit.status, 'completed'); assert.equal(visit.completionIntegrity, 'current');
    assert.equal(visit.version, original.visit.version); assert.equal(visit.actualCompletedAt, original.visit.actualCompletedAt);
    const assignmentId = original.capture.assignment.id, capture = await get(apiRoot + '/assignments/' + assignmentId);
    assert.equal(capture.studyId, benchmark.study.id); assert.equal(capture.assignment.subjectId, sample.subject.id);
    assert.equal(capture.assignment.subjectVisitId, visit.id); assert.equal(capture.assignment.formVersion.id, benchmark.refs.form);
    assert.equal(capture.response.status, 'submitted'); assert.equal(capture.response.locked, true); assert.equal(capture.response.review, 'review_approved');
    assert.equal(capture.response.version, original.capture.response.version); assert.deepEqual(capture.response.ref, original.capture.response.ref);
    assert.deepEqual(capture.response.answers, original.capture.response.answers); assert.deepEqual(normalizeAnswers(name, capture.response.answers), expectedRows[name].answers);
    const ref = capture.response.ref;
    const revision = (await get(apiRoot + '/assignments/' + assignmentId + '/revisions/' + ref.revisionNo + '?' + new URLSearchParams({responseId: ref.responseId, contentHash: ref.contentHash}))).revision;
    for (const field of ['ref', 'answers', 'source', 'actorKind', 'actorId', 'sourceSubmittedAt', 'createdAt']) assert.deepEqual(revision[field], original.revision[field]);
    if (name === 'H5') {
      assert.equal(capture.assignment.mode, 'patient_h5');
      for (const [field, value] of Object.entries(captured.h5Original)) assert.deepEqual(revision[field], value, 'ORIGINAL_H5_FACT_CHANGED');
    }
    if (name === 'CSV') {
      // revision.source denotes the researcher actor; the immutable import receipt proves the CSV channel.
      const proof = original.importSource; assert(proof?.receipt?.requestKey);
      const imported = await get(apiRoot + '/imports/receipts/' + proof.receipt.requestKey);
      assert.equal(imported.studyId, benchmark.study.id); assert.deepEqual(imported.receipt, proof.receipt); assert.deepEqual(imported.source, proof.source);
      assert.equal(imported.source.kind, 'csv_import');
      assert.equal(imported.rows.length, 1); assert.deepEqual(imported.rows[0], proof.row);
      assert.deepEqual(proof.row.ref, ref); assert.equal(proof.row.subjectId, sample.subject.id); assert.equal(proof.row.visitId, visit.id);
      assert.equal(proof.row.subjectCode, sample.subject.subjectId); assert.equal(proof.row.visitCode, 'BASELINE');
    }
    facts[name] = {subject: sample.subject, visit, capture, revision};
  }
  currentFacts = facts;
  return facts;
}
function sameDefinition(actual) {
  if (!validAnalysisDefinition(actual)) return false;
  const {reason: ignoredActualReason, subjectIds: actualSubjects, ...actualFixed} = actual;
  const {reason: ignoredWantedReason, subjectIds: wantedSubjects, ...wantedFixed} = definition;
  return same(actualFixed, wantedFixed) && same([...actualSubjects].sort(), [...wantedSubjects].sort());
}
async function readPlan(planId, cursor) {
  const value = await get(analysisRoot + '/plans/' + planId + '?' + new URLSearchParams({limit: '20', ...(cursor ? {cursor} : {})}));
  assert(validAnalysisPlan(value, benchmark.study.id, planId)); assert(sameDefinition(value.definition), 'MAIN_PLAN_SCOPE_OR_FIELDS_CHANGED');
  return value;
}
function assertManifest(manifest) {
  assert.equal(manifest.rowCount, 3); assert.equal(manifest.subjectCount, 3);
  assert.deepEqual(manifest.rows.map(row => row.subjectId).sort(), [...subjectIds].sort());
  assert.deepEqual(manifest.variables, definition.variables);
  for (const name of names) {
    const fact = currentFacts[name], row = manifest.rows.find(row => row.subjectId === fact.subject.id);
    assert(row); assert.equal(row.visitId, fact.visit.id); assert.equal(row.enrollmentId, fact.visit.enrollmentId);
    assert.equal(row.visitStatus, 'completed'); assert.equal(row.completionIntegrity, 'current'); assert.equal(row.visitVersion, fact.visit.version);
    assert.equal(row.cells.length, 3);
    for (const variable of definition.variables) {
      const cell = row.cells.find(cell => cell.key === variable.key); assert(cell);
      const present = Object.prototype.hasOwnProperty.call(fact.capture.response.answers, variable.fieldKey);
      const raw = fact.capture.response.answers[variable.fieldKey];
      assert.deepEqual(cell.value, present ? raw : null);
      assert.equal(cell.missing, !present ? 'not_recorded' : raw === null ? 'null' : null);
      assert.equal(cell.unit, variable.unit); assert.equal(cell.source.formVersionId, benchmark.refs.form); assert.equal(cell.source.fieldKey, variable.fieldKey);
      assert.equal(cell.source.responseVersion, fact.capture.response.version); assert.deepEqual(cell.source.ref, fact.capture.response.ref);
    }
  }
}
async function readSnapshot(planValue, snapshotId) {
  const value = await get(analysisRoot + '/snapshots/' + snapshotId);
  assert(validAnalysisSnapshot(value, planValue, snapshotId), 'MAIN_CURRENT_SNAPSHOT_INVALID'); assertManifest(value.manifest);
  return value;
}
async function ready() {
  await page.waitForFunction(() => {const main = document.querySelector('main.rh-formal-analysis'); return main && main.getAttribute('aria-busy') === 'false' && !main.textContent.includes('正在读取分析计划');});
  assert.equal(await page.getByRole('button', {name: '核对上次操作结果', exact: true}).count(), 0, 'UNKNOWN_UI_OPERATION_REQUIRES_ORIGINAL_GET_ONLY');
}
function rememberResult(action, result) {
  journal.planId = result.planId;
  if (action === 'release') journal.snapshotId = result.snapshotId;
}
async function phaseWrite(action, planId, validate, click) {
  assert.equal(journal.pending, null, 'UNKNOWN_WRITE_FORBIDS_NEW_MUTATION');
  armed = {action, planId, path: '/api' + analysisRoot + '/plans' + (action === 'submit' ? '' : '/' + planId + (action === 'review' ? '/reviews' : '/snapshots')), validate, used: false};
  const awaitedPath = armed.path;
  const responsePromise = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === awaitedPath);
  responsePromise.catch(() => {});
  try {
    await click();
    const response = await responsePromise, result = await response.json();
    assert.equal(response.status(), 200, JSON.stringify({action, status: response.status(), code: result?.code}));
    assert(armed.used && journal.pending);
    const pending = journal.pending, marker = {studyId: benchmark.study.id, planId, action, requestKey: pending.requestKey};
    assert(validAnalysisResult(result, marker));
    const receipt = await get(pending.receiptPath);
    assert(validAnalysisResult(receipt, marker)); assert.deepEqual(receipt, result);
    journal.history.push({...pending, confirmedAt: new Date().toISOString(), response: result}); rememberResult(action, result);
    journal.pending = null; saveJournal();
    await assertMainFacts();
    return result;
  } finally {armed = null;}
}
async function confirmPhase(action, planId, button, confirmButton, validate) {
  await assertMainFacts(); // Before opening the actual shared confirmation, never rewrite any original source.
  await page.waitForLoadState('networkidle'); // Let current-authority reads settle before the deliberate UI action.
  await page.getByRole('button', {name: button, exact: true}).click();
  const dialog = page.getByRole('dialog'); await dialog.waitFor();
  return phaseWrite(action, planId, validate, () => dialog.getByRole('button', {name: confirmButton, exact: true}).click());
}
async function tableMatches(manifest) {
  const table = page.getByRole('table', {name: '分析变量原值与来源', exact: true}); await table.waitFor();
  assert.equal(await table.locator('tbody tr').count(), 3);
  for (const name of names) {
    const fact = currentFacts[name], projected = manifest.rows.find(row => row.subjectId === fact.subject.id);
    const row = table.locator('tbody tr').filter({has: page.getByText(fact.subject.subjectId, {exact: true})});
    assert.equal(await row.count(), 1);
    for (const [index, variable] of definition.variables.entries()) {
      const cell = row.locator('td').nth(index + 1), projectedCell = projected.cells.find(cell => cell.key === variable.key);
      assert.equal(await cell.locator('span').innerText(), displayAnalysisCell(projectedCell));
      const href = await cell.getByRole('link', {name: '查看第1修订来源', exact: true}).getAttribute('href');
      const target = new URL(href, base), ref = fact.capture.response.ref;
      assert.equal(target.pathname, '/pages/s09/');
      for (const [key, value] of Object.entries({formalCapture: '1', studyId: benchmark.study.id, visitId: fact.visit.id, assignmentId: ref.assignmentId, responseId: ref.responseId, revisionNo: '1', contentHash: ref.contentHash})) assert.equal(target.searchParams.get(key), value);
    }
  }
}

try {
  assert.equal((await assertFixtureTarget(fixtureEnvironment())).databaseName, 'wp01_test_full_baseline');
  mkdirSync(out, {recursive: true});
  save('inputs.json', {benchmarkFile, captureFile, captureSha256, oraclePath, oracleSha256, h5EvidenceSha256: oracle.h5EvidenceSha256, uiFreezeFile: freezePath, uiFreezeSha256: hash(readFileSync(freezePath)), studyId: benchmark.study.id, mainSubjectIds: subjectIds});
  const me = await get('/auth/me'); assert.equal(me.tenantId, benchmark.scope.tenantId); assert.equal(me.role, 'tenant_admin'); assert.equal(me.isTenantAdmin, true);
  save('actor.json', {accountId: me.accountId, tenantId: me.tenantId, role: me.role, isTenantAdmin: me.isTenantAdmin, authVersion: me.authVersion});
  if (journal.pending) {
    stage = 'unknown-original-receipt-read-only';
    const pending = journal.pending, receipt = await get(pending.receiptPath, {allow404: true});
    save('unknown-recovery.json', {pending, receipt, newBusinessWrites: 0});
    if (!receipt.notFound) {
      assert(validAnalysisResult(receipt, {studyId: benchmark.study.id, planId: pending.planId, action: pending.action, requestKey: pending.requestKey}));
      journal.history.push({...pending, recoveredReadOnlyAt: new Date().toISOString(), response: receipt}); rememberResult(pending.action, receipt); journal.pending = null; saveJournal();
    }
    throw Error('UNKNOWN_ORIGINAL_GET_CHECKED_STOP_FOR_ROOT_REVIEW_NO_REPLAY');
  }
  await assertMainFacts(); save('main-sources-before.json', currentFacts);
  checks.push('only_original_main_three_current_approved_locked_completed_sources_and_h5_ref_verified');
  const configuration = await get(apiRoot + '/configuration'); assert.equal(configuration.study.id, benchmark.study.id);
  const protocol = configuration.protocols.find(value => value.id === benchmark.protocolId); assert(protocol?.status === 'executing');
  const baseline = protocol.visitPlans.find(visit => visit.code === 'BASELINE'); assert(baseline);
  const fixedForms = configuration.forms.filter(form => baseline.requirements.some(requirement => requirement.kind === 'form_response' && requirement.config?.formVersionId === form.id));
  assert.equal(fixedForms.length, 1); const form = fixedForms[0]; assert.equal(form.id, benchmark.refs.form); assert.equal(form.status, 'published');
  assert.deepEqual(form.schema, captured.final.ONSITE.capture.assignment.formVersion.schema);
  assert.deepEqual(form.schema.fields.map(field => field.key), ['value', 'optional_value', 'completed']);
  definition = {schemaVersion: 't15-synthetic-plan-v1', dataClassification: 'synthetic', purposeKey: 'synthetic-research-only', method: 'descriptive', statisticalUnit: 'subject', protocolVersionId: benchmark.protocolId, visitCode: 'BASELINE', subjectIds, variables: form.schema.fields.map((field, index) => ({key: 'v' + (index + 1), formVersionId: form.id, fieldKey: field.key, valueType: field.type, unit: typeof field.unit === 'string' && field.unit.trim() ? field.unit : null})), ...syntheticPlanVersions, reason: 'T18主三渠道合成验收：仅原现场、CSV、自填三例，固定基线、三字段、原修订与科研用途。'};
  assert(validAnalysisDefinition(definition)); save('expected-plan.json', definition);

  if (!journal.planId && existsSync(pointerPath)) {
    const acceptedFile = readJson(pointerPath).acceptedFile, previous = readJson(acceptedFile);
    assert(previous.passed && previous.syntheticOnly); assert.equal(previous.studyId, benchmark.study.id); assert.equal(previous.oracleSha256, oracleSha256); assert.equal(previous.captureSha256, captureSha256);
    assert.deepEqual(previous.h5Original, captured.h5Original);
    journal.planId = previous.planId; journal.snapshotId = previous.snapshotId; saveJournal();
  }
  // Prevent a duplicate main plan if a successful exact main-three plan already exists outside this journal.
  if (!journal.planId) {
    const candidates = [], seen = new Set(); let cursor = null;
    for (let number = 0; ; number++) {
      assert(number < 100, 'PLAN_DIRECTORY_BOUND_EXCEEDED');
      const value = await get(analysisRoot + '/plans?' + new URLSearchParams({limit: '20', ...(cursor ? {cursor} : {})})); assert(validAnalysisPage(value, benchmark.study.id));
      for (const item of value.items) {assert(!seen.has(item.planId)); seen.add(item.planId); if (sameDefinition(item.definition)) candidates.push(item);}
      if (!value.nextCursor) break; assert.notEqual(value.nextCursor, cursor); cursor = value.nextCursor;
    }
    save('existing-main-plan-candidates.json', candidates);
    assert(candidates.length <= 1, 'MULTIPLE_MAIN_PLANS_REQUIRE_ROOT_SELECTION');
    if (candidates.length) {
      const candidate = await readPlan(candidates[0].planId);
      assert(candidate.review?.decision === 'approved' && candidate.snapshots.length > 0, 'EXISTING_UNJOURNALED_MAIN_PLAN_REQUIRES_ROOT_REVIEW');
      const existing = await readSnapshot(candidate, candidate.snapshots[0].snapshotId);
      journal.planId = candidate.planId; journal.snapshotId = existing.basis.snapshotId; saveJournal(); reused = true;
    }
  }
  if (journal.planId) {
    plan = await readPlan(journal.planId);
    if (journal.snapshotId) {snapshot = await readSnapshot(plan, journal.snapshotId); reused = true;}
    else if (plan.review?.decision === 'approved' && plan.snapshots.length) {
      snapshot = await readSnapshot(plan, plan.snapshots[0].snapshotId); journal.snapshotId = snapshot.basis.snapshotId; saveJournal(); reused = true;
    }
  }

  const {chromium} = createRequire(workspaceRoot + 'app/package.json')('./node_modules/.pnpm/playwright@1.63.0/node_modules/playwright');
  browser = await chromium.launch({headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  context = await browser.newContext({viewport: {width: 1440, height: 1000}, recordVideo: {dir: out + 'video'}});
  const separator = cookie.indexOf('='); await context.addCookies([{name: cookie.slice(0, separator), value: cookie.slice(separator + 1), domain: '127.0.0.1', path: '/api', httpOnly: true, sameSite: 'Lax'}]);
  await context.route('**/api/**', async route => {
    const request = route.request(), parsed = new URL(request.url());
    try {
      assert.equal(parsed.origin, base);
      if (request.method() === 'GET' || request.method() === 'POST' && parsed.pathname === '/api/auth/renew') return await route.continue();
      assert(armed && !armed.used && request.method() === 'POST' && parsed.pathname === armed.path, 'UNARMED_BUSINESS_MUTATION_BLOCKED');
      const body = request.postDataJSON(); armed.validate(body); assert.equal(journal.pending, null); assert.equal(typeof body.requestKey, 'string'); armed.used = true;
      journal.pending = {runId, stage, action: armed.action, planId: armed.planId, requestKey: body.requestKey, body, at: new Date().toISOString(), receiptPath: receiptPath(armed.action, armed.planId, body.requestKey)}; saveJournal();
      await route.continue(); // Gate only: no response is mocked, fulfilled, or changed.
    } catch (error) {guardErrors.push({stage, method: request.method(), path: parsed.pathname, message: error.message}); await route.abort('blockedbyclient');}
  });
  page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', async dialog => {errors.push('Unexpected native dialog: ' + dialog.type()); await dialog.dismiss();});
  page.on('response', response => {
    const request = response.request(), parsed = new URL(response.url()); if (!parsed.pathname.startsWith('/api/')) return;
    const record = {at: new Date().toISOString(), stage, via: 'browser', method: request.method(), path: parsed.pathname + parsed.search, status: response.status()}; network.push(record);
    if (request.method() === 'POST' && parsed.pathname.startsWith('/api' + analysisRoot)) {
      const job = response.json().then(value => responses.push({...record, request: request.postDataJSON(), response: value})).catch(() => {record.responseUnavailable = true;});
      responseJobs.add(job); job.finally(() => responseJobs.delete(job));
    }
  });
  await page.goto(uiUrl(journal.planId, journal.snapshotId)); await ready();
  if (!plan) {
    stage = 's05-main-three-plan-ui'; await page.getByText('新建合成分析计划', {exact: true}).click();
    await page.getByLabel('分析研究方案', {exact: true}).selectOption(benchmark.protocolId);
    assert.equal(await page.locator('.fa-create fieldset input').count(), 3); assert.equal(await page.locator('.fa-create fieldset input:checked').count(), 3);
    for (const [index, name] of names.entries()) {
      const subject = benchmark.cases[name].subject;
      await page.getByLabel('分析受试者编号', {exact: true}).fill(subject.subjectId);
      const found = page.waitForResponse(response => response.request().method() === 'GET' && new URL(response.url()).pathname === '/api' + apiRoot + '/subjects'); found.catch(() => {});
      await page.getByRole('button', {name: '搜索受试者', exact: true}).click(); const response = await found; assert.equal(response.status(), 200);
      const result = await response.json(); assert(result.items.some(item => item.id === subject.id && item.subjectId === subject.subjectId));
      const candidate = page.locator('.fa-candidates li').filter({has: page.getByText(subject.subjectId, {exact: true})}); assert.equal(await candidate.count(), 1);
      await candidate.getByRole('button', {name: '选择受试者', exact: true}).click();
      await page.getByText('已选择' + (index + 1) + ' / 3名受试者。', {exact: true}).waitFor();
    }
    await page.getByLabel('分析计划理由', {exact: true}).fill(definition.reason); await page.getByLabel('确认合成分析范围', {exact: true}).check();
    await page.screenshot({path: out + 'main-three-exact-selection.png', fullPage: true});
    const submitted = await confirmPhase('submit', null, '提交分析计划', '确认提交计划', body => assert.deepEqual(body.definition, definition));
    await page.waitForURL(value => value.searchParams.get('planId') === submitted.planId); await page.locator('.fa-plan>h3').waitFor(); await ready();
    plan = await readPlan(submitted.planId); checks.push('actual_s05_search_select_original_main_three_fixed_baseline_three_fields_submit');
  }
  if (plan.review?.decision !== 'approved') {
    assert.equal(plan.review, null, 'REVOKED_MAIN_PLAN_REQUIRES_ROOT_REVIEW_NO_AUTOMATIC_REAPPROVAL');
    stage = 'admin-current-plan-approval'; assert(plan.capabilities.canReviewPlan);
    await page.getByLabel('分析计划审批理由', {exact: true}).fill('核对原主三例、三字段、基线、合成SAP与映射约定，仅授权本次合成科研使用。');
    const result = await confirmPhase('review', plan.planId, '批准分析计划', '确认批准计划', body => {assert.equal(body.expectedSequence, 0); assert.equal(body.decision, 'approved'); assert(body.reason.trim());});
    assert.equal(result.decision, 'approved'); plan = await readPlan(plan.planId); checks.push('actual_admin_s05_approves_exact_main_plan');
    await ready();
  }
  assert.equal(plan.review.decision, 'approved');
  if (!snapshot) {
    stage = 'current-main-original-value-preview'; await assertMainFacts();
    const pendingPreview = page.waitForResponse(response => response.request().method() === 'GET' && new URL(response.url()).pathname === '/api' + analysisRoot + '/plans/' + plan.planId + '/preview'); pendingPreview.catch(() => {});
    await page.getByRole('button', {name: '核对当前分析数据', exact: true}).click(); const response = await pendingPreview; assert.equal(response.status(), 200);
    const preview = await response.json(); assert(validAnalysisPreview(preview, plan)); assertManifest(preview.manifest);
    assert.equal(preview.evaluation.status, 'review_required'); assert.equal(preview.evaluation.blockingCount, 0); assert.deepEqual(preview.evaluation.blockingFingerprints, []);
    save('current-preview.json', preview); await tableMatches(preview.manifest);
    await page.screenshot({path: out + 'main-original-values-and-exact-refs.png', fullPage: true});
    checks.push('actual_current_preview_matches_oracle_zero_false_explicit_csv_missing_and_all_original_refs');
    stage = 'main-snapshot-manual-release'; assert(plan.capabilities.canReleaseSnapshot);
    await page.getByLabel('分析快照放行理由', {exact: true}).fill('逐行核对原主三例、0/false/缺失、原修订和当前用途，零结构阻断，放行此固定合成分析依据。');
    const released = await confirmPhase('release', plan.planId, '核对并放行快照', '确认放行快照', body => {assert.equal(body.previewHash, preview.manifestHash); assert(body.reason.trim());});
    assert.equal(released.manifestHash, preview.manifestHash);
    await page.getByText('已读取固定快照，当前来源与使用条件已核对。', {exact: false}).waitFor(); await ready();
    plan = await readPlan(plan.planId); snapshot = await readSnapshot(plan, released.snapshotId); checks.push('actual_s05_manual_reasoned_release_and_current_snapshot_readback');
  } else checks.push('existing_successful_exact_main_plan_snapshot_revalidated_read_only_without_new_business_write');
  await assertMainFacts(); snapshot = await readSnapshot(plan, snapshot.basis.snapshotId);
  await tableMatches(snapshot.manifest);
  await page.screenshot({path: out + 'main-current-fixed-snapshot.png', fullPage: true});
  assert.equal(journal.pending, null); assert.deepEqual(errors, []); assert.deepEqual(guardErrors, []); await Promise.allSettled([...responseJobs]);
  const result = {passed: true, at: new Date().toISOString(), runId, syntheticOnly: true, studyId: benchmark.study.id, planId: plan.planId, snapshotId: snapshot.basis.snapshotId, captureFile, captureSha256, oracleSha256, h5Original: captured.h5Original, subjectIds, definition: plan.definition, plan, snapshot, checks, network, responses, errors, guardErrors, reusedExisting: reused, pending: null, browserAcceptance: true, clinicalAcceptance: false, productionAcceptance: false, analysisExecuted: false, reportExecuted: false, originalMainSourcesUnchanged: true};
  save('result.json', result); writeFileSync(pointerPath, JSON.stringify({acceptedFile: out + 'result.json'}) + '\n', {mode: 0o600});
  console.log(JSON.stringify({passed: true, evidence: out + 'result.json', planId: plan.planId, snapshotId: snapshot.basis.snapshotId, checks}));
} catch (error) {
  if (existsSync(out)) {
    await Promise.allSettled([...responseJobs]); save('failure.json', {passed: false, at: new Date().toISOString(), stage, message: error.message, checks, network, responses, errors, guardErrors, pending: journal.pending, knownPlanId: journal.planId, knownSnapshotId: journal.snapshotId, automaticReplayAttempted: false});
    if (page) {await page.screenshot({path: out + 'failure.png', fullPage: true}).catch(() => {}); writeFileSync(out + 'failure.txt', await page.locator('main').innerText().catch(() => 'unavailable'));}
  }
  console.error(JSON.stringify({passed: false, stage, message: error.message, evidence: existsSync(out) ? out + 'failure.json' : null})); process.exitCode = 1;
} finally {await context?.close(); await browser?.close();}
