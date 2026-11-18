import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
export const registryDetailHash = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const fail = () => { throw new Error('REGISTRY_EXTRACTION_REJECTED'); };
const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join(',') === [...keys].sort().join(',');
export function validateRegistryDetails(value, source) {
  const enriched=value?.schemaVersion===2;
  if (!exactKeys(value, ['schemaVersion', 'extractorVersion', 'registrationNumber', 'sourceUrl', 'snapshotDate', 'design', 'arms', 'outcomes',...(enriched?['registration']:[])]) ||
      ![1,2].includes(value.schemaVersion) || value.extractorVersion !== 'chictr-mhtml-v1' ||
      value.registrationNumber !== source.externalKey || value.sourceUrl !== source.sourceUrl ||
      typeof value.snapshotDate !== 'string' || value.snapshotDate.length > 100 ||
      !Array.isArray(value.design) || value.design.length !== 7 ||
      !Array.isArray(value.arms) || value.arms.length < 1 || value.arms.length > 12 ||
      !Array.isArray(value.outcomes) || value.outcomes.length < 1 || value.outcomes.length > 60) fail();
  const checkField = field => {
    const position = field?.source;
    if (!exactKeys(field, ['key', 'label', 'value', 'status', 'source']) ||
        typeof field.key !== 'string' || typeof field.label !== 'string' || field.label.length > 50 ||
        typeof field.value !== 'string' || field.value.length > 12000 ||
        field.status !== (field.value ? 'reported' : 'not_reported') ||
        !exactKeys(position, ['tableIndex', 'rowIndex', 'cellIndex', 'line', 'column', 'sourceLabel', 'quote']) ||
        position.quote !== field.value || typeof position.sourceLabel !== 'string' || position.sourceLabel.length > 1000 ||
        !['tableIndex', 'rowIndex', 'cellIndex', 'line', 'column'].every(key =>
          Number.isSafeInteger(position[key]) && position[key] >= 1 && position[key] <= 100000)) fail();
  };
  if(enriched){
    if(!Array.isArray(value.registration)||value.registration.map(x=>x?.key).join(',')!=='registeredOn,leadInstitution,registrationStatus')fail();
    value.registration.forEach(checkField);
    const date=value.registration[0].value;
    if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date))fail();
  }
  if (value.design.map(field => field.key).join(',') !== 'studyType,phase,design,objective,randomization,blinding,protocol') fail();
  value.design.forEach(checkField);
  value.arms.forEach((arm, index) => {
    if (!exactKeys(arm, ['id', 'name', 'sampleSize', 'intervention']) || arm.id !== `arm-${index + 1}`) fail();
    for (const key of ['name', 'sampleSize', 'intervention']) { if (arm[key]?.key !== key) fail(); checkField(arm[key]); }
  });
  value.outcomes.forEach((outcome, index) => {
    if (!exactKeys(outcome, ['id', 'name', 'englishName', 'type', 'timepoint', 'method']) || outcome.id !== `outcome-${index + 1}`) fail();
    for (const key of ['name', 'englishName', 'type', 'timepoint', 'method']) { if (outcome[key]?.key !== key) fail(); checkField(outcome[key]); }
  });
  return value;
}

export function extractRegistryDetails(bytes, source, {includeRegistration=false}={}) {
  if (createHash('sha256').update(bytes).digest('hex') !== source.expectedSha256)
    throw new Error('REGISTRY_SOURCE_HASH_MISMATCH');
  const parsed = spawnSync('python3', [fileURLToPath(new URL('../../scripts/parse-clinical-mhtml.py', import.meta.url)),
    source.sourceUrl, source.externalKey,...(includeRegistration?['--registration']:[])], { input: bytes, maxBuffer: 1024 * 1024, timeout: 10000 });
  if (parsed.error || parsed.status !== 0) throw new Error('REGISTRY_PARSE_FAILED:' + String(parsed.stderr).slice(0, 250));
  return validateRegistryDetails(JSON.parse(parsed.stdout), source);
}
