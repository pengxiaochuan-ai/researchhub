import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../../../..');
const json = async name => JSON.parse(await readFile(path.join(here, name), 'utf8'));
const definition = await json('../phq9-form-v1.json');
const golden = await json('../phq9-golden-inputs.json');
const body = await json('form-version-patch-body.json');
const dictionary = await json('field-dictionary.json');
const presentation = await json('presentation-requirements.json');
const { parseCaptureCsv } = await import(pathToFileURL(path.join(root, 'researchhub/server/research-capture/import-csv.mjs')));
const { importTemplate } = await import(pathToFileURL(path.join(root, 'researchhub/src/capture-import-session.js')));
const require = createRequire(path.join(root, 'app/server/package.json'));
const ts = require('typescript');
const operatorPath = 'app/server/src/study-operations/study-forms-policy.ts';
const operatorSource = await readFile(path.join(root, operatorPath), 'utf8');
const { outputText } = ts.transpileModule(operatorSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const core = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const fields = body.schema.fields;
const score = answers => core.scorePublishedFormResponse(body.schema, body.scoring, answers);
const tests = [];
function check(name, fn) { fn(); tests.push({ name, passed: true }); }
check('draft, dictionary and presentation preserve source-frozen content', () => {
  assert.deepEqual(body.schema, definition.formSchema);
  assert.deepEqual(Object.keys(body).sort(), ['schema', 'scoring']);
  assert.equal(body.scoring.algorithm, 'numeric-sum-v1');
  assert.deepEqual(core.normalizeFormSchema(body.schema), body.schema);
  assert.equal(dictionary.sourceContentVersion, definition.versionId);
  assert.deepEqual(dictionary.fields.map(field => [field.key, field.label]), body.schema.fields.map(field => [field.key, field.label]));
  assert.deepEqual(presentation.choices, definition.content.answerOptions.map(({ value, label }) => ({ value, label })));
  assert.equal(presentation.title, definition.content.title);
  assert.equal(presentation.recallPeriodPrompt, definition.content.recallPeriodPrompt);
  assert.equal(presentation.authorCreditAndPermission, definition.content.permissionNotice);
  assert.equal(presentation.initialSelection, null);
  assert.equal(presentation.implemented, false);
});
const template = await readFile(path.join(here, 'csv-template.csv'), 'utf8');
check('empty template exactly reuses current front-end BOM/CRLF template', () => assert.equal(template, importTemplate(fields)));
check('header-only CSV cannot be submitted as data', () => assert.throws(() => parseCaptureCsv(template, fields)));
const exampleCsv = await readFile(path.join(here, 'csv-synthetic-examples.csv'), 'utf8');
const parsed = parseCaptureCsv(exampleCsv, fields);
check('existing CSV decoder accepts synthetic rows without coercion errors', () => {
  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.rows.length, golden.cases.length);
});
for (let i = 0; i < golden.cases.length; i++) {
  check('CSV roundtrip and existing score: ' + golden.cases[i].name, () => {
    const row = parsed.rows[i];
    assert.equal(row.subjectCode, 'SYNTH-PHQ9-001');
    assert.equal(row.visitCode, 'V' + (i + 1));
    for (let q = 0; q < 9; q++) assert.equal(row.answers[definition.scoring.scoredKeys[q]], golden.cases[i].values[q]);
    assert.equal(score(row.answers).total, golden.cases[i].expectedTotal);
    assert.equal(score(row.answers).complete, true);
  });
}
for (const key of definition.scoring.scoredKeys) {
  check('CSV blank ' + key + ' remains missing and prevents complete total', () => {
    const values = fields.map(field => field.key === key || field.key === 'functional_difficulty' ? '' : '0');
    const row = parseCaptureCsv(template + ['SYNTH-PHQ9-MISSING', 'V1', ...values].join(',') + '\r\n', fields).rows[0];
    assert.equal(row.answers[key], null);
    assert.equal(score(row.answers).total, null);
    assert.equal(score(row.answers).complete, false);
  });
}
check('Chinese frequency label in numeric CSV is rejected rather than silently mapped', () => {
  const values = fields.map(field => field.key === 'phq9_q1' ? '有几天' : field.key === 'functional_difficulty' ? '' : '0');
  const out = parseCaptureCsv(template + ['SYNTH-PHQ9-INVALID', 'V1', ...values].join(',') + '\r\n', fields);
  assert.ok(out.errors.some(error => error.code === 'IMPORT_VALUE_INVALID' && error.fieldKey === 'phq9_q1'));
});
check('out-of-range integer decoded as number is rejected by fixed scoring core', () => {
  assert.throws(() => score({ ...parsed.rows[0].answers, phq9_q1: 4 }));
});
check('functional difficulty code cannot alter total or replace a missing scored item', () => {
  for (const option of fields.at(-1).options) {
    const answers = { ...parsed.rows[0].answers, functional_difficulty: option.value };
    assert.equal(score(answers).total, golden.cases[0].expectedTotal);
    delete answers.phq9_q1;
    assert.equal(score(answers).total, null);
  }
});
check('duplicate subject/visit rows are detected by existing CSV parser', () => {
  const row = ['SYNTH-PHQ9-DUPLICATE', 'V1', ...fields.map(field => field.score === false ? '' : '0')].join(',') + '\r\n';
  assert.ok(parseCaptureCsv(template + row + row, fields).errors.some(error => error.code === 'IMPORT_DUPLICATE_ROW'));
});
check('unsupported top-level instructions really are not preserved by current normalizer', () => {
  const normalized = core.normalizeFormSchema({ ...body.schema, title: definition.content.title, recallPeriodPrompt: definition.content.recallPeriodPrompt });
  assert.equal('title' in normalized, false);
  assert.equal('recallPeriodPrompt' in normalized, false);
});
const bindings = await json('visit-bindings-unbound.json');
check('visit intent is explicitly unbound and does not add CSV capture mode', () => {
  assert.equal(bindings.executable, false);
  assert.deepEqual(bindings.visits.map(v => v.code), ['V1', 'V2', 'V3', 'V4']);
  for (const visit of bindings.visits) {
    assert.equal(visit.requirement.config.formVersionId, null);
    assert.deepEqual(visit.requirement.config.allowedCaptureModes, ['researcher', 'patient_h5']);
  }
  assert.equal(bindings.healthyGroupVisitScopeConfirmed, false);
});
const manifest = await json('build-manifest.json');
for (const [name, hash] of Object.entries(manifest.artifacts)) {
  const actual = createHash('sha256').update(await readFile(path.join(here, name))).digest('hex');
  check('generated bytes fixed: ' + name, () => assert.equal(actual, hash));
}
const sources = {};
for (const name of [operatorPath, 'researchhub/server/research-capture/import-csv.mjs', 'researchhub/src/capture-import-session.js']) {
  sources[name] = createHash('sha256').update(await readFile(path.join(root, name))).digest('hex');
}
const report = { checkedAt: new Date().toISOString(), status: 'passed', checks: tests.length, tests,
  scope: 'generated preparation artifacts and existing pure CSV/template/scoring contracts only', operatorHashes: sources,
  runtimeRequests: 0, databaseWrites: 0, browserVerification: false, published: false, functionalAcceptanceClaimed: false };
await writeFile(path.join(here, 'preparation-verification.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, checks: report.checks, scope: report.scope }));
