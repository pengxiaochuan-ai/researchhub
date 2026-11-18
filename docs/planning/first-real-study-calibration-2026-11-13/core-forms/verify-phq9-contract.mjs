// Public synthetic examples only. Exercises existing pure operators, never a DB/API.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../../..');
const require = createRequire(path.join(root, 'app/server/package.json'));
const ts = require('typescript');
const definition = JSON.parse(await readFile(path.join(here, 'phq9-form-v1.json'), 'utf8'));
const golden = JSON.parse(await readFile(path.join(here, 'phq9-golden-inputs.json'), 'utf8'));
const source = JSON.parse(await readFile(path.join(root, definition.sourceRef), 'utf8'));
const actualPdfHash = createHash('sha256')
  .update(await readFile(path.join(root, source.source_pdf_file))).digest('hex');
const operatorHashes = {};
async function operator(relative) {
  const sourceText = await readFile(path.join(root, relative), 'utf8');
  operatorHashes[relative] = createHash('sha256').update(sourceText).digest('hex');
  const { outputText } = ts.transpileModule(sourceText, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}
const formCore = await operator('app/server/src/study-operations/study-forms-policy.ts');
const scaleCore = await operator('app/server/src/scales/scale-version-policy.ts');
const results = [];
function check(name, fn) { fn(); results.push({ name, passed: true }); }
const keys = definition.scoring.scoredKeys;
const toAnswers = values => Object.fromEntries(keys.map((key, index) => [key, values[index]]));
const score = answers => formCore.scorePublishedFormResponse(definition.formSchema, definition.scoring, answers);
const scoreScale = values => scaleCore.scoreVersionedItems({
  ...definition.scaleVersionCandidate,
  answers: values.map((rawScore, index) => ({ itemNo: String(index + 1), rawScore })),
});

check('exact nine item text and four frequency options preserved', () => {
  assert.deepEqual(definition.content.scoredItems, source.scored_items);
  assert.deepEqual(definition.content.answerOptions, source.answer_options);
  assert.deepEqual(definition.content.functionalDifficulty, source.functional_difficulty);
  assert.equal(keys.length, 9);
  for (let i = 0; i < keys.length; i++) {
    assert.equal(definition.formSchema.fields[i].label, source.scored_items[i].text);
    assert.equal(definition.formSchema.fields[i].score, true);
    assert.equal(definition.formSchema.fields[i].required, true);
  }
  assert.deepEqual(definition.formSchema.fields[9].options.map(x => x.label), source.functional_difficulty.options.map(x => x.label));
});
check('source original PDF hash fixed', () => {
  assert.equal(definition.sourcePdfSha256, source.source_pdf_sha256);
  assert.equal(actualPdfHash, source.source_pdf_sha256);
});
for (const example of golden.cases) {
  check(`form and scale cores: ${example.name}`, () => {
    const answer = score(toAnswers(example.values));
    assert.equal(answer.total, example.expectedTotal);
    assert.equal(answer.complete, true);
    assert.equal(answer.scoredCount, 9);
    assert.equal(scoreScale(example.values).total, example.expectedTotal);
  });
}
for (let i = 0; i < keys.length; i++) {
  for (const missing of ['omitted', null, '']) {
    check(`form missing ${keys[i]} ${String(missing)} never totals`, () => {
      const answers = toAnswers(golden.cases[0].values);
      if (missing === 'omitted') delete answers[keys[i]];
      else answers[keys[i]] = missing;
      assert.equal(score(answers).total, null);
      assert.equal(score(answers).complete, false);
    });
  }
  check(`scale missing item ${i + 1} never totals`, () => {
    const values = [...golden.cases[0].values]; values[i] = null;
    assert.equal(scoreScale(values).total, null);
    assert.equal(scoreScale(values).status, 'incomplete');
  });
}
for (const option of definition.formSchema.fields[9].options) {
  check(`functional choice ${option.value} excluded from sum`, () => {
    const answers = { ...toAnswers(golden.cases[1].values), functional_difficulty: option.value };
    assert.equal(score(answers).total, golden.cases[1].expectedTotal);
    delete answers[keys[0]];
    assert.equal(score(answers).total, null);
  });
}
for (const [name, value] of Object.entries({ below: -1, above: 4, fraction: 0.5, string: '2', boolean: true, nan: NaN, infinity: Infinity, object: {} })) {
  check(`form rejects ${name}`, () => {
    assert.throws(() => score({ ...toAnswers(golden.cases[0].values), [keys[0]]: value }));
  });
  check(`scale rejects ${name}`, () => {
    const values = [...golden.cases[0].values]; values[0] = value;
    assert.throws(() => scoreScale(values));
  });
}
check('form rejects caller total field', () => {
  assert.throws(() => score({ ...toAnswers(golden.cases[0].values), total: 27 }));
});
check('scale rejects caller supplied total', () => {
  assert.throws(() => scaleCore.scoreVersionedItems({ ...definition.scaleVersionCandidate, answers: [], clientTotal: 27 }));
});
check('scale rejects duplicate item', () => {
  assert.throws(() => scaleCore.scoreVersionedItems({ ...definition.scaleVersionCandidate, answers: [{ itemNo: '1', rawScore: 0 }, { itemNo: '1', rawScore: 3 }] }));
});
check('candidate has no clinical diagnosis or published runtime claims', () => {
  assert.equal(definition.projectPolicy.clinicalDiagnosticCutoff, null);
  assert.equal(definition.projectPolicy.missingPolicyIsSourceRule, false);
  assert.equal(definition.runtime.published, false);
  assert.equal(definition.presentationContract.renderingVerifiedInRuntime, false);
});
const report = {
  checkedAt: new Date().toISOString(), status: 'passed', scope: 'public synthetic data; existing pure form and scale operators only',
  checks: results.length, results, operatorHashes, sourceContentVersion: definition.versionId,
  goldenInputsDerivation: golden.derivation, runtimeCalls: 0, databaseWrites: 0,
  functionalAcceptanceClaimed: false, browserAcceptanceClaimed: false,
};
await writeFile(path.join(here, 'phq9-contract-verification.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, checks: report.checks, scope: report.scope }));
