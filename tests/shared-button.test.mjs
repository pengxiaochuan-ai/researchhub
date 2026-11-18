import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

// Load the production JSX with the project's existing runtime, without a mock
// component, a second test renderer, or a browser/DOM dependency.
const server = await createServer({
  root: fileURLToPath(new URL('..', import.meta.url)),
  configFile: false,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});
after(() => server.close());
const { Button } = await server.ssrLoadModule('/pages/shared/Components.jsx');

function render(props = {}) {
  return renderToStaticMarkup(React.createElement(Button, { children: '保存草稿', ...props }));
}

function click(element) {
  const event = new Event('click', { cancelable: true });
  element.props.onClick?.(event);
  return event;
}

test('a shared action inside a form defaults to button instead of implicit submit', () => {
  const markup = renderToStaticMarkup(React.createElement('form', null,
    React.createElement(Button, null, '保存草稿')));
  assert.match(markup, /<button\b[^>]*\btype="button"/);
});

test('an explicitly declared submit action retains its native submit type', () => {
  assert.match(render({ type: 'submit' }), /<button\b[^>]*\btype="submit"/);
});

test('native form, identification, description and event props reach the real button', () => {
  const onFocus = () => {};
  const element = Button({
    children: '保存草稿', id: 'save-draft', name: 'intent', value: 'draft',
    form: 'research-form', title: '保存当前研究', 'aria-describedby': 'save-help',
    'data-action': 'save', onFocus,
  });
  const markup = renderToStaticMarkup(element);
  for (const attribute of ['id="save-draft"', 'name="intent"', 'value="draft"',
    'form="research-form"', 'title="保存当前研究"', 'aria-describedby="save-help"',
    'data-action="save"']) {
    assert.ok(markup.includes(attribute), `missing native attribute ${attribute}`);
  }
  assert.equal(element.props.onFocus, onFocus);
});

test('native text attributes are escaped when rendered rather than inserted as markup', () => {
  const markup = render({ title: '<研究> & "草稿"' });
  assert.ok(markup.includes('title="&lt;研究&gt; &amp; &quot;草稿&quot;"'));
  assert.ok(!markup.includes('<研究>'));
});

test('an enabled action forwards its original click event once', () => {
  const received = [];
  const element = Button({ children: '保存草稿', onClick: event => received.push(event) });
  const event = click(element);
  assert.deepEqual(received, [event]);
  assert.equal(event.defaultPrevented, false);
});

test('disabled actions expose native disabled state and reject callback execution', () => {
  let calls = 0;
  const element = Button({ children: '保存草稿', disabled: true, onClick: () => calls++ });
  assert.equal(element.props.disabled, true);
  assert.match(renderToStaticMarkup(element), /<button\b[^>]*\bdisabled=""/);
  const event = click(element);
  click(element);
  assert.equal(calls, 0);
  assert.equal(event.defaultPrevented, true);
});

test('loading actions expose busy and disabled state and reject repeated clicks', () => {
  let calls = 0;
  const element = Button({ children: '保存草稿', loading: true, onClick: () => calls++ });
  assert.equal(element.props.disabled, true);
  assert.equal(element.props['aria-busy'], true);
  const event = click(element);
  click(element);
  assert.equal(calls, 0);
  assert.equal(event.defaultPrevented, true);
});

test('loading has readable default feedback while retaining the original accessible content', () => {
  const markup = render({ loading: true });
  assert.ok(markup.includes('保存草稿'));
  assert.match(markup, /<span\b[^>]*aria-hidden="true"[^>]*>处理中…<\/span>/);
  assert.match(markup, /aria-busy="true"/);
});

test('custom busy feedback keeps an explicit accessible name and description intact', () => {
  const markup = render({
    loading: true, busyLabel: '正在保存…', 'aria-label': '保存研究草稿',
    'aria-describedby': 'save-help',
  });
  assert.ok(markup.includes('aria-label="保存研究草稿"'));
  assert.ok(markup.includes('aria-describedby="save-help"'));
  assert.match(markup, /<span\b[^>]*aria-hidden="true"[^>]*>正在保存…<\/span>/);
  assert.ok(markup.includes('保存草稿'));
  assert.ok(!/\b(?:loading|busyLabel|primary|danger)=/.test(markup));
});

test('loading cannot be overridden by a conflicting native busy attribute', () => {
  const element = Button({ children: '保存草稿', loading: true, 'aria-busy': false });
  assert.equal(element.props['aria-busy'], true);
});

test('the caller can recover from a failed request and enable a retry', () => {
  let calls = 0;
  const action = { children: '保存草稿', onClick: () => calls++ };
  click(Button(action));
  click(Button({ ...action, loading: true }));
  const recovered = Button({ ...action, loading: false, disabled: false });
  assert.equal(recovered.props.disabled, false);
  assert.notEqual(recovered.props['aria-busy'], true);
  assert.ok(!renderToStaticMarkup(recovered).includes('处理中…'));
  click(recovered);
  assert.equal(calls, 2);
});

test('ending loading does not override a separate caller disabled condition', () => {
  let calls = 0;
  const element = Button({ children: '保存草稿', loading: false, disabled: true, onClick: () => calls++ });
  assert.equal(element.props.disabled, true);
  click(element);
  assert.equal(calls, 0);
});

test('existing primary, danger and caller classes remain on the native button', () => {
  const element = Button({ children: '保存草稿', primary: true, danger: true, className: 'research-action' });
  assert.equal(element.type, 'button');
  assert.deepEqual(element.props.className.trim().split(/\s+/),
    ['ui-button', 'primary', 'danger', 'research-action']);
});
