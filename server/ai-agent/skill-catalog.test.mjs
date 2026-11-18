import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { loadSkillCatalog, verifySkillSnapshot, SKILL_DEFINITIONS } from './skill-catalog.mjs';

const hubRoot = new URL('../../', import.meta.url);

test('all nine supplied packs have verifiable snapshots, not runtime activation', async () => {
  const catalog = await loadSkillCatalog(hubRoot);
  assert.equal(catalog.skills.length, 9);
  assert.equal(new Set(catalog.skills.map(s => s.key)).size, 9);
  for (const skill of catalog.skills) {
    assert.match(skill.snapshotHash, /^[a-f0-9]{64}$/);
    assert.ok(skill.resources.some(r => r.path === 'SKILL.md'));
    assert.equal(skill.runtimeState, 'not-equipped');
    assert.equal(skill.rights.status, 'unverified');
    assert.ok(skill.taskExamples.positive.length && skill.taskExamples.negative.length);
    assert.ok(await verifySkillSnapshot(hubRoot, skill));
  }
  const pubmed = catalog.skills.find(s => s.key === 'pubmed-medical-literature');
  assert.equal(pubmed.requiredTools.length, 11);
  assert.ok(pubmed.requiredTools.includes('pubmed_fetch_fulltext'));
  const report = catalog.skills.find(s => s.key === 'doubao-medical-report');
  assert.ok(report.taskExamples.negative.includes('生成本研究的统计分析报告'));
});

test('editing an asset invalidates its fixed skill snapshot', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hub-skill-snapshot-'));
  const definition = SKILL_DEFINITIONS[0];
  const pack = join(root, 'skill', definition.key);
  await mkdir(join(pack, 'assets'), { recursive: true });
  await writeFile(join(pack, 'SKILL.md'), `---\nname: ${definition.key}\n---\n说明`);
  await writeFile(join(pack, 'assets', 'template.md'), '原始模板');
  const { skills: [snapshot] } = await loadSkillCatalog(root, [definition]);
  assert.equal(await verifySkillSnapshot(root, snapshot), true);
  await writeFile(join(pack, 'assets', 'template.md'), '新的模板');
  assert.equal(await verifySkillSnapshot(root, snapshot), false);
});

test('source discovery rejects symlinks instead of reading outside a skill pack', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hub-skill-boundary-'));
  const definition = SKILL_DEFINITIONS[0];
  const pack = join(root, 'skill', definition.key);
  await mkdir(pack, { recursive: true });
  await writeFile(join(pack, 'SKILL.md'), `---\nname: ${definition.key}\n---\n说明`);
  await writeFile(join(root, 'private.txt'), 'must not enter snapshot');
  await symlink(join(root, 'private.txt'), join(pack, 'private.txt'));
  await assert.rejects(loadSkillCatalog(root, [definition]), /SKILL_SOURCE_SYMLINK/);
});

test('unexpected declared identity is not equipped under a trusted key', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hub-skill-identity-'));
  const definition = SKILL_DEFINITIONS[0];
  await mkdir(join(root, 'skill', definition.key), { recursive: true });
  await writeFile(join(root, 'skill', definition.key, 'SKILL.md'), '---\nname: other-skill\n---\n说明');
  await assert.rejects(loadSkillCatalog(root, [definition]), /SKILL_SOURCE_IDENTITY/);
});
