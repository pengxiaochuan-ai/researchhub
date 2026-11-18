import test from 'node:test';import assert from 'node:assert/strict';
import {detailPurposeStatements,detailPurposeSourceHash} from './research-assets-detail-purpose-schema.mjs';
const ids=Object.fromEntries(['tenant','group','project','owner','admin'].map(k=>[k,'rh-kb-local-test-'+k]));
test('owned purpose migration is exact, legacy stays two and new is version-bound, no public or role writes',()=>{
 const s=detailPurposeStatements(ids).join('\n');assert.match(s,/BEFORE INSERT OR UPDATE ON rh_asset.access_request/);assert.match(s,/IN \(2,4\)/);assert.match(s,/ARRAY\['read_body','cite'\]/);assert.match(s,/NEW.version_no/);assert.match(s,/apply/);assert.doesNotMatch(s,/UPDATE public\.|ALTER ROLE|SECURITY DEFINER|GRANT ALL/);assert.equal(detailPurposeSourceHash(ids),detailPurposeSourceHash(ids));
});
