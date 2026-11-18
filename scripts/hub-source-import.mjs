import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFixtureInput } from '../../app/server/scripts/wp01/local-config.mjs';
import { assertFixtureTarget } from '../../app/server/scripts/wp01/fixture-guard.mjs';
import { previewWorkbook } from './hub-source-preview.mjs';
import { stageBatch } from '../server/hub-sources/staging-repository.mjs';
import { withHubSourceTransaction } from '../server/hub-sources/fixture-transaction.mjs';

const configPath = fileURLToPath(new URL('../../.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json', import.meta.url));
const runtimePath = fileURLToPath(new URL('../../.tmp/researchhub-knowledge-local/runtime.json', import.meta.url));
const snapshotDir = fileURLToPath(new URL('../../.tmp/researchhub-source-snapshots/', import.meta.url));
const python = '/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3';
const approved = [
  { filePath: fileURLToPath(new URL('../docs/中文针灸情志病（去重).xlsx', import.meta.url)),
    fileSha256: 'ccde9859c505b7d5c8441c641492a28b887ec66e05c3b215807dfb62f7b8b661',
    sheetName: '针灸情志病_合并', sourceKey: 'zh-acupuncture-affective', rowCount: 10537 },
  { filePath: fileURLToPath(new URL('../docs/英文针灸情志病（去重).xlsx', import.meta.url)),
    fileSha256: '5480fc35627b2bd253e60279d9a8ee8d07c8b349b069376fe02f99077feca055',
    sheetName: '英文针灸情志病去重后', sourceKey: 'en-acupuncture-affective', rowCount: 5160 },
];
const sha256 = data => createHash('sha256').update(data).digest('hex');

async function controlledSnapshot(spec) {
  const input = await readFile(spec.filePath);
  if (sha256(input) !== spec.fileSha256) throw new Error('HUB_SOURCE_INPUT_CHANGED');
  await mkdir(snapshotDir, { recursive: true, mode: 0o700 });
  const snapshotPath = snapshotDir + spec.fileSha256 + '.xlsx';
  try { await writeFile(snapshotPath, input, { flag: 'wx', mode: 0o600 }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  const snapshot = await readFile(snapshotPath);
  const info = await stat(snapshotPath);
  if (!info.isFile() || sha256(snapshot) !== spec.fileSha256 || (info.mode & 0o077) !== 0)
    throw new Error('HUB_SOURCE_SNAPSHOT_REJECTED');
  return snapshotPath;
}

export async function importApprovedWorkbooks() {
  const { env } = loadFixtureInput(configPath);
  const target = await assertFixtureTarget(env);
  if (target.databaseName !== 'wp01_test_full_baseline') throw new Error('HUB_SOURCE_TARGET_REJECTED');
  const { ids } = JSON.parse(await readFile(runtimePath, 'utf8'));
  const results = [];
  for (const spec of approved) {
    const snapshotPath = await controlledSnapshot(spec);
    const preview = await previewWorkbook({ filePath: snapshotPath,
      sheetName: spec.sheetName, sourceKey: spec.sourceKey, mapperVersion: 'v1', python });
    if (preview.fileSha256 !== spec.fileSha256 || preview.rows.length !== spec.rowCount)
      throw new Error('HUB_SOURCE_PREVIEW_CHANGED');
    const result = await withHubSourceTransaction(env, async tx => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
      return stageBatch({ db: tx, tenantId: ids.tenant, hubKey: 'lingshu-xinyu', preview,
        source: { createdBy: ids.admin, snapshotPath, snapshotSha256: spec.fileSha256,
          fileName: basename(spec.filePath) } });
    });
    results.push({ ...result, rowCount: spec.rowCount, sourceKey: spec.sourceKey,
      fileSha256: spec.fileSha256 });
  }
  return results;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.length !== 3 || process.argv[2] !== '--apply') {
    process.stderr.write('Usage: node scripts/hub-source-import.mjs --apply\n');
    process.exitCode = 2;
  } else {
    importApprovedWorkbooks().then(results => process.stdout.write(JSON.stringify(results) + '\n'))
      .catch(error => { process.stderr.write(`${error.code || error.message}\n`); process.exitCode = 1; });
  }
}
