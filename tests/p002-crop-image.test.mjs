import test from 'node:test';
import assert from 'node:assert/strict';
import {loadCropImage} from '../pages/p002/crop-image.js';

// The browser owns fetching/decoding. Keep its event boundary real without
// building a fake document or making a network request in a unit test.
class ImageFixture extends EventTarget {
  complete = false;
  naturalWidth = 0;
  source = '';
  onSource = () => {};
  set src(value) { this.source = value; this.onSource(this); }
  get src() { return this.source; }
  settle(success) {
    this.complete = true;
    this.naturalWidth = success ? 1586 : 0;
    this.dispatchEvent(new Event(success ? 'load' : 'error'));
  }
}

function fixture() {
  const attributes = new Map();
  return {
    image: new ImageFixture(),
    frame: {dataset: {}, setAttribute: (name, value) => attributes.set(name, value)},
    status: {textContent: '', hidden: true},
    attributes,
  };
}

test('cropped source starts fetching eagerly even without an intersection observer', () => {
  const {image, frame, status, attributes} = fixture();
  image.onSource = current => {
    assert.equal(current.loading, 'eager');
    assert.equal(current.width, 1586);
    assert.equal(current.height, 992);
  };
  loadCropImage(image, frame, 'assets/reference-6.png', status);
  assert.equal(image.src, 'assets/reference-6.png');
  assert.equal(image.loading, 'eager');
  assert.equal(image.width, 1586);
  assert.equal(image.height, 992);
  assert.equal(frame.dataset.imageState, 'loading');
  assert.equal(attributes.get('aria-busy'), 'true');
  assert.equal(status.hidden, false);
  assert.match(status.textContent, /加载中/);
});

test('successful load removes the loading feedback without changing the source', () => {
  const {image, frame, status, attributes} = fixture();
  loadCropImage(image, frame, 'assets/reference-6.png', status);
  image.settle(true);
  assert.equal(frame.dataset.imageState, 'loaded');
  assert.equal(attributes.get('aria-busy'), 'false');
  assert.equal(status.hidden, true);
  assert.equal(image.src, 'assets/reference-6.png');
});

test('a cached source resolves immediately when no later load event is delivered', () => {
  const {image, frame, status, attributes} = fixture();
  image.onSource = current => { current.complete = true; current.naturalWidth = 1586; };
  loadCropImage(image, frame, 'assets/reference-6.png', status);
  assert.equal(frame.dataset.imageState, 'loaded');
  assert.equal(status.hidden, true);
  assert.equal(attributes.get('aria-busy'), 'false');
});

test('a failed source shows an honest recoverable error rather than leaving a blank card', () => {
  const {image, frame, status, attributes} = fixture();
  loadCropImage(image, frame, 'assets/reference-6.png', status);
  image.settle(false);
  assert.equal(frame.dataset.imageState, 'error');
  assert.equal(attributes.get('aria-busy'), 'false');
  assert.equal(status.hidden, false);
  assert.match(status.textContent, /未加载.*刷新.*重试/);
});

test('an already failed cached source does not remain in the loading state', () => {
  const {image, frame, status} = fixture();
  image.onSource = current => { current.complete = true; current.naturalWidth = 0; };
  loadCropImage(image, frame, 'assets/reference-6.png', status);
  assert.equal(frame.dataset.imageState, 'error');
  assert.equal(status.hidden, false);
});

test('decorative crops load and settle without adding a status label', () => {
  const {image, frame} = fixture();
  loadCropImage(image, frame, 'assets/reference-2.png');
  image.settle(true);
  assert.equal(frame.dataset.imageState, 'loaded');
});

test('listeners catch synchronous source completion before the post-assignment cache check', () => {
  const {image, frame, status} = fixture();
  image.onSource = current => {
    current.settle(false);
    assert.equal(frame.dataset.imageState, 'error');
  };
  loadCropImage(image, frame, 'assets/reference-6.png', status);
  assert.equal(frame.dataset.imageState, 'error');
  assert.equal(status.hidden, false);
});
