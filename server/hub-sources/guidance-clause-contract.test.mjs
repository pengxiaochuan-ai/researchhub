import test from 'node:test';
import assert from 'node:assert/strict';
import { initialFive } from './initial-five.mjs';
import { guidancePayload, validateGuidancePayload, guidanceHash } from './guidance-clause-contract.mjs';

test('three fixed PDF excerpts preserve physical/printed pages and exact source text, never substitute metadata or OCR garbage', () => {
  const sources = initialFive.filter(item => item.mimeType === 'application/pdf');
  assert.equal(sources.length, 3);
  for (const source of sources) {
    const payload = guidancePayload(source.externalKey);
    assert.equal(payload.clauses.length, 4);
    assert.equal(payload.pageCount, source.metadata.pages);
    assert.ok(payload.clauses.every(c => c.pdfPage >= 1 && c.pdfPage <= payload.pageCount && c.printedPage && c.anchor && !c.quote.includes('/G')));
    assert.equal(validateGuidancePayload(payload, source), payload);
    const changed = structuredClone(payload); changed.clauses[0].pdfPage++;
    assert.throws(() => validateGuidancePayload(changed, source), /GUIDANCE_EXTRACTION_REJECTED/);
    const leaked = structuredClone(payload); leaked.contact = 'not allowed';
    assert.throws(() => validateGuidancePayload(leaked, source), /GUIDANCE_EXTRACTION_REJECTED/);
    assert.throws(() => validateGuidancePayload(payload, { ...source, expectedSha256: '0'.repeat(64) }), /GUIDANCE_EXTRACTION_REJECTED/);
    assert.equal(guidanceHash(payload), guidanceHash(JSON.parse(JSON.stringify(payload))));
  }
  assert.equal(guidancePayload('T/CAAM 0010-2020').clauses[2].printedPage, '2');
  assert.equal(guidancePayload('T/CAAM 0010-2020').clauses[2].pdfPage, 8);
  const guideline = guidancePayload('ZJ/T E003-2014');
  assert.ok(guideline.editionNotice.includes('2014'));
  assert.deepEqual(guideline.clauses.map(c => c.pdfPage), [9, 9, 17, 17]);
  assert.ok(guideline.clauses[1].quote.includes('中重度'));
  assert.ok(guideline.clauses[2].quote.endsWith('[12]。'));
  assert.equal(guidancePayload('ChiCTR2300073486'), null);
});
