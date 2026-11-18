import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../../../..');
const definition = JSON.parse(await readFile(path.join(here, '../phq9-form-v1.json'), 'utf8'));
const golden = JSON.parse(await readFile(path.join(here, '../phq9-golden-inputs.json'), 'utf8'));
const { importTemplate } = await import(pathToFileURL(path.join(root, 'researchhub/src/capture-import-session.js')));
const fields = definition.formSchema.fields;
const json = (name, value) => writeFile(path.join(here, name), JSON.stringify(value, null, 2) + '\n');
const cell = value => /[",\r\n]/.test(value) ? '"' + value.replaceAll('"', '""') + '"' : value;
const csv = rows => '\uFEFF' + rows.map(row => row.map(value => cell(String(value))).join(',')).join('\r\n') + '\r\n';
const dictionary = fields.map(field => ({
  key: field.key, label: field.label, storageType: field.type, requiredForCandidateSubmission: field.required,
  scored: field.score !== false, min: field.min ?? null, max: field.max ?? null,
  options: field.key === 'functional_difficulty' ? field.options : definition.content.answerOptions.map(({ value, label }) => ({ value, label })),
  missing: field.score === false ? 'not_in_total' : 'no_total_without_all_nine_valid_items',
}));
await json('form-version-patch-body.json', { schema: definition.formSchema, scoring: { algorithm: definition.scoring.algorithm } });
await json('field-dictionary.json', {
  sourceContentVersion: definition.versionId, sourcePdfSha256: definition.sourcePdfSha256,
  targetColumns: [{ key: 'subject_code', meaning: '现有假名受试者编号' }, { key: 'visit_code', meaning: '现有方案访视标识' }],
  fields: dictionary, missingPolicyAuthority: 'project_candidate_policy_not_original_PHQ_rule',
  functionalCodesAreSourcePoints: false,
});
await writeFile(path.join(here, 'field-dictionary.csv'), csv([
  ['key', '原文题项', '存储类型', '候选必填', '计入合计', '最小值', '最大值', '原文选项与存储值', '缺失语义'],
  ...dictionary.map(field => [field.key, field.label, field.storageType, field.requiredForCandidateSubmission, field.scored, field.min ?? '', field.max ?? '', JSON.stringify(field.options), field.missing]),
]));
await writeFile(path.join(here, 'csv-template.csv'), importTemplate(fields));
const examples = golden.cases.map((example, index) => [
  'SYNTH-PHQ9-001', 'V' + (index + 1), ...example.values, index === 0 ? '' : 'difficulty_' + index,
]);
await writeFile(path.join(here, 'csv-synthetic-examples.csv'), csv([
  ['subject_code', 'visit_code', ...fields.map(field => field.key)], ...examples,
]));
await json('visit-bindings-unbound.json', {
  documentType: 'binding_intent_not_api_request', executable: false, publishedVersionId: null,
  sourceContentVersion: definition.versionId, healthyGroupVisitScopeConfirmed: false,
  intendedPopulation: '抑郁症病内核心比较主体；健康组适用时点另行确认',
  visits: ['V1', 'V2', 'V3', 'V4'].map(code => ({ code,
    requirement: { kind: 'form_response', config: { formVersionId: null, allowedCaptureModes: ['researcher', 'patient_h5'] } },
    captureModesStatus: 'proposal_requires_actual_consent_and_protocol_configuration',
    CSVIsTransportOfResearcherMode: true,
  })),
});
await json('presentation-requirements.json', {
  documentType: 'implementation_requirements_not_runtime_schema', implemented: false,
  sourceContentVersion: definition.versionId, title: definition.content.title,
  recallPeriodPrompt: definition.content.recallPeriodPrompt, instruction: definition.content.instruction,
  authorCreditAndPermission: definition.content.permissionNotice,
  scoredFields: definition.scoring.scoredKeys,
  choices: definition.content.answerOptions.map(({ value, label }) => ({ value, label })),
  initialSelection: null, storedType: 'integer', arbitraryNumericEntryAllowed: false,
  functionalDifficulty: definition.content.functionalDifficulty,
  reviewerPreviewAndHistoricalReadingMustUseSameVersion: true,
  backendTopLevelPresentationPersistenceImplemented: false,
  safetyFollowupSOP: 'pending_actual_study_policy_not_invented',
});
const artifacts = ['form-version-patch-body.json', 'field-dictionary.json', 'field-dictionary.csv', 'csv-template.csv', 'csv-synthetic-examples.csv', 'visit-bindings-unbound.json', 'presentation-requirements.json'];
const hashes = {};
for (const name of artifacts) hashes[name] = createHash('sha256').update(await readFile(path.join(here, name))).digest('hex');
await json('build-manifest.json', { sourceContentVersion: definition.versionId, artifacts: hashes, generatedOnly: true, runtimeRequests: 0, databaseWrites: 0 });
console.log(JSON.stringify({ generatedArtifacts: artifacts.length, published: false }));
