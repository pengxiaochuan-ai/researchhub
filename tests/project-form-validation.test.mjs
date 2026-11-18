import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProjectForm } from '../src/project-form-validation.js';

const complete = {
  name: '针灸维持治疗研究',
  question: '是否改善12个月复发率？',
  pico: { p: '缓解期患者', i: '针灸', c: '常规随访', o: '12个月复发率' },
};

test('完整问题与PICO可以进入下一步，验证不会改动原输入', () => {
  const values = { ...complete, name: '  针灸维持治疗研究  ', pico: { ...complete.pico } };
  const before = structuredClone(values);
  assert.deepEqual(validateProjectForm(values, { forNextStep: true }), {
    errors: {}, firstInvalidField: null, valid: true,
  });
  assert.deepEqual(values, before);
});

test('保存草稿只要求课题名称，允许未完成的问题和PICO', () => {
  const result = validateProjectForm({ name: '待完善课题', question: '', pico: {} });
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, {});
});

test('空白名称定位到课题名称，下一步按表单顺序返回全部错误', () => {
  const values = { name: '  ', question: '', pico: { p: '', i: '', c: '', o: '' } };
  const draft = validateProjectForm(values);
  assert.deepEqual(draft.errors, { name: '请填写研究课题名称。' });
  assert.equal(draft.firstInvalidField, 'name');
  assert.equal(draft.valid, false);

  const next = validateProjectForm(values, { forNextStep: true });
  assert.deepEqual(Object.keys(next.errors), ['name', 'question', 'p', 'i', 'c', 'o']);
  assert.equal(next.firstInvalidField, 'name');
  assert.equal(next.valid, false);
});

test('核心问题需要中文或英文问号结尾，忽略末尾空白', () => {
  for (const question of ['是否改善结局？  ', 'Does treatment help?']) {
    assert.equal(validateProjectForm({ ...complete, question }, { forNextStep: true }).valid, true);
  }
  const result = validateProjectForm({ ...complete, question: '研究长期疗效。' }, { forNextStep: true });
  assert.deepEqual(result.errors, { question: '请将核心研究问题写为以“？”或“?”结尾的问句。' });
  assert.equal(result.firstInvalidField, 'question');
});

test('各PICO字段分别校验，修正一个字段后仍定位到剩余首个错误', () => {
  const result = validateProjectForm({ ...complete, pico: { ...complete.pico, i: ' ', o: '' } }, { forNextStep: true });
  assert.deepEqual(result.errors, { i: '请填写干预。', o: '请填写结局与时间。' });
  assert.equal(result.firstInvalidField, 'i');
  const corrected = validateProjectForm({ ...complete, pico: { ...complete.pico, o: '' } }, { forNextStep: true });
  assert.deepEqual(corrected.errors, { o: '请填写结局与时间。' });
  assert.equal(corrected.firstInvalidField, 'o');
});
