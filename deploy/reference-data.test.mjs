import test from 'node:test';
import assert from 'node:assert/strict';
import {referenceDataSql,referenceDataReceipt} from './reference-data.mjs';
test('explicit reference seed binds the reviewed complete snapshot, locks and refuses partial replacement',()=>{
 assert.equal(referenceDataReceipt.rows,3213);
 assert.equal(referenceDataReceipt.version,'MCA-2024-12-31');
 assert.match(referenceDataReceipt.rowsSha256,/^[a-f0-9]{64}$/);
 const sql=referenceDataSql();
 assert.match(sql,/^BEGIN;/);assert.match(sql,/EXCLUSIVE MODE/);
 assert.match(sql,/REFERENCE_DATA_MISMATCH/);assert.equal((sql.match(/\bEXCEPT\b/g)??[]).length,2);
 assert.match(sql,/WHERE NOT EXISTS/);assert.match(sql,/COMMIT;$/);
 assert.doesNotMatch(sql,/\b(?:GRANT|DELETE|UPDATE|TRUNCATE)\b/);
});
