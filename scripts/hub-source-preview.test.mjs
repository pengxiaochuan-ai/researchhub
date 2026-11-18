import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { previewWorkbook } from './hub-source-preview.mjs';

const python = '/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3';

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'rh-source-preview-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'synthetic.xlsx');
  const code = `from openpyxl import Workbook
import sys
w=Workbook(); s=w.active; s.title='主表'
s.append(['SrcDatabase-来源库','Title-题名','Author-作者','Source-文献来源','Summary-摘要','Year-年','URL-网址','DOI-DOI'])
s.append(['Open Source','针灸与情志','甲;乙','合成期刊','摘要'*300,2025,'https://example.org/a','10.1234/a'])
s.append(['Open Source',None,'丙','合成期刊','缺题名',2024,'https://example.org/b','10.1234/b'])
s.append(['Other Source','第二篇','丁','合成期刊','另一摘要',2023,'javascript:alert(1)','invalid-doi'])
s.append(['Open Source','重复 DOI','戊','合成期刊','第三摘要',2022,'https://example.org/c','10.1234/a'])
extra=w.create_sheet('来源备份'); extra.append(['not main']); extra.append(['do not sum'])
w.save(sys.argv[1])`;
  const made = spawnSync(python, ['-c', code, path], { encoding: 'utf8' });
  assert.equal(made.status, 0, made.stderr);
  return path;
}

test('previews only the explicit main sheet and retains every raw row', async t => {
  const filePath = fixture(t);
  const preview = await previewWorkbook({ filePath, sheetName: '主表',
    sourceKey: 'synthetic-book', mapperVersion: 'v1', python });
  assert.match(preview.fileSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(preview.sheets.map(s => s.name), ['主表', '来源备份']);
  assert.equal(preview.rows.length, 4);
  assert.deepEqual(preview.rows.map(r => r.rowNumber), [2, 3, 4, 5]);
  assert.equal(preview.rows[0].raw['Summary-摘要'].length, 600);
  assert.match(preview.rows[0].rowSha256, /^[a-f0-9]{64}$/);
  assert.ok(preview.rows[1].errors.includes('TITLE_MISSING'));
  assert.ok(preview.rows[2].errors.includes('URL_INVALID'));
  assert.ok(preview.rows[2].errors.includes('DOI_INVALID'));
  assert.ok(preview.rows[3].errors.includes('DOI_DUPLICATE_CANDIDATE'));
  assert.equal(preview.rows[0].sourceName, 'Open Source');
  assert.equal(preview.rows[2].sourceName, 'Other Source');
});

test('rejects an unspecified or absent sheet and does not create an output file', async t => {
  const filePath = fixture(t);
  await assert.rejects(() => previewWorkbook({ filePath, sourceKey: 'synthetic-book', mapperVersion: 'v1', python }),
    /HUB_SOURCE_SHEET_REQUIRED/);
  await assert.rejects(() => previewWorkbook({ filePath, sheetName: 'not-here', sourceKey: 'synthetic-book', mapperVersion: 'v1', python }),
    /HUB_SOURCE_SHEET_NOT_FOUND/);
  assert.equal(existsSync(filePath + '.json'), false);
});
