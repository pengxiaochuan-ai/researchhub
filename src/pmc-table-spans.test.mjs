import test from 'node:test';
import assert from 'node:assert/strict';
import { pmcTableRows } from './pmc-table-spans.js';

test('PMC table cell spans remain aligned with JATS row-major text', () => {
  assert.deepEqual(pmcTableRows({ rows: [['Arm', 'n'], ['Treatment', '12'], ['Note']],
    spans: [[1, 1], [1, 1], [1, 1], [1, 1], [1, 2]] }), [
    [{ text: 'Arm', rowSpan: 1, colSpan: 1 }, { text: 'n', rowSpan: 1, colSpan: 1 }],
    [{ text: 'Treatment', rowSpan: 1, colSpan: 1 }, { text: '12', rowSpan: 1, colSpan: 1 }],
    [{ text: 'Note', rowSpan: 1, colSpan: 2 }],
  ]);
});
