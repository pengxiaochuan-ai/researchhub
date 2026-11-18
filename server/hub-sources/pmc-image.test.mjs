import test from 'node:test';
import assert from 'node:assert/strict';
import { imageMimeFromBytes } from './pmc-image.mjs';

test('PMC inline preview accepts only inert raster image bytes', () => {
  assert.equal(imageMimeFromBytes(Buffer.from('89504e470d0a1a0a0000', 'hex')), 'image/png');
  assert.equal(imageMimeFromBytes(Buffer.from('ffd8ffe00000', 'hex')), 'image/jpeg');
  assert.equal(imageMimeFromBytes(Buffer.from('4749463839610000', 'hex')), 'image/gif');
  assert.equal(imageMimeFromBytes(Buffer.from('52494646000000005745425056503820', 'hex')), 'image/webp');
  assert.equal(imageMimeFromBytes(Buffer.from('<svg onload="alert(1)"></svg>')), null);
  assert.equal(imageMimeFromBytes(Buffer.from('<html>unsafe</html>')), null);
});
