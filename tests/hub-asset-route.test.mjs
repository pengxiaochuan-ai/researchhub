import test from 'node:test';
import assert from 'node:assert/strict';
import {safeHubAssetReturn} from '../src/hub-asset-route.js';
import {safeSessionReturn} from '../src/session-lifecycle.js';
import {safeAuthenticatedReturnTo} from '../src/route-context.js';
test('Hub catalog and copied draft return to exact safe local route after login',()=>{
 for(const path of ['/pages/h01/?hubKey=lingshu-xinyu&section=assets','/pages/h01/?section=assets&copyId=draft-one','/pages/g02/?view=hub-assets']){assert.equal(safeHubAssetReturn(path),path);assert.equal(safeSessionReturn(path),path);assert.equal(safeAuthenticatedReturnTo(path),path);}
});
test('asset returns reject external URLs, wrong Hub, ambiguous fields and secret hashes',()=>{
 for(const path of ['https://evil.test/pages/h01/?section=assets','//evil.test/pages/h01/?section=assets','/pages/h01/?section=assets&hubKey=another','/pages/h01/?section=assets&copyId=a&copyId=b','/pages/h01/?section=assets&token=secret','/pages/h01/?section=assets#secret','/pages/g02/?view=hub-assets&extra=1'])assert.equal(safeHubAssetReturn(path),null);
});
