import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('the touched applicability detail uses shared business dialogs and keeps browser unload protection',()=>{
 const source=readFileSync(new URL('../pages/shared/AssetApplicabilityDetail.jsx',import.meta.url),'utf8');
 assert.doesNotMatch(source,/window\.(?:confirm|alert|prompt)\(/);
 assert.match(source,/<ConfirmDialog/);assert.match(source,/beforeunload/);assert.match(source,/returnFocus=/);
});
