import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const worker = fileURLToPath(new URL('./hub-source-xlsx.py', import.meta.url));
const hash = value => createHash('sha256').update(value).digest('hex');
const field = (raw, prefix) => Object.entries(raw).find(([key]) => key.startsWith(prefix))?.[1];
const text = value => value == null ? '' : String(value).trim();

export async function previewWorkbook({ filePath, sheetName, sourceKey, mapperVersion, python }) {
  if (!sheetName || typeof sheetName !== 'string') throw new Error('HUB_SOURCE_SHEET_REQUIRED');
  if (!sourceKey || !mapperVersion || !filePath || !python) throw new Error('HUB_SOURCE_PREVIEW_CONFIG_REQUIRED');
  const metadata = await stat(filePath);
  if (!metadata.isFile() || metadata.size > 80 * 1024 * 1024) throw new Error('HUB_SOURCE_FILE_REJECTED');
  const fileSha256 = hash(await readFile(filePath));
  let parsed;
  try {
    const { stdout } = await run(python, [worker, filePath, sheetName], {
      encoding: 'utf8', maxBuffer: 256 * 1024 * 1024,
      env: { PATH: process.env.PATH || '', PYTHONDONTWRITEBYTECODE: '1' },
    });
    parsed = JSON.parse(stdout);
  } catch (error) {
    if (error.stderr?.includes('HUB_SOURCE_SHEET_NOT_FOUND')) throw new Error('HUB_SOURCE_SHEET_NOT_FOUND');
    throw new Error('HUB_SOURCE_XLSX_REJECTED');
  }
  const seenDoi = new Set();
  const rows = parsed.rows.map(({ rowNumber, raw }) => {
    const title = text(field(raw, 'Title-'));
    const doi = text(field(raw, 'DOI-')).replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '');
    const url = text(field(raw, 'URL-'));
    const errors = [];
    if (!title) errors.push('TITLE_MISSING');
    if (doi && !/^10\.\d{4,9}\/\S+$/i.test(doi)) errors.push('DOI_INVALID');
    if (url && !/^https?:\/\/\S+$/i.test(url)) errors.push('URL_INVALID');
    const doiKey = doi.toLowerCase();
    if (doiKey && seenDoi.has(doiKey)) errors.push('DOI_DUPLICATE_CANDIDATE');
    if (doiKey) seenDoi.add(doiKey);
    return {
      rowNumber, raw, rowSha256: hash(JSON.stringify({ rowNumber, raw })),
      sourceName: text(field(raw, 'SrcDatabase-')) || 'UNSPECIFIED',
      title, doi, url, errors,
    };
  });
  return { filePath, fileSha256, sheetName, sourceKey, mapperVersion,
    sheets: parsed.sheets, rows };
}
