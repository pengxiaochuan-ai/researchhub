export function validateProjectForm(values, { forNextStep = false } = {}) {
  const errors = {};
  if (!values.name?.trim()) errors.name = '请填写研究课题名称。';

  if (forNextStep) {
    if (!values.question?.trim()) errors.question = '请填写核心研究问题。';
    else if (!/[？?]$/.test(values.question.trim())) {
      errors.question = '请将核心研究问题写为以“？”或“?”结尾的问句。';
    }
    for (const [key, label] of Object.entries({ p: '人群', i: '干预', c: '对照', o: '结局与时间' })) {
      if (!values.pico?.[key]?.trim()) errors[key] = `请填写${label}。`;
    }
  }

  const firstInvalidField = Object.keys(errors)[0] ?? null;
  return { errors, firstInvalidField, valid: firstInvalidField === null };
}
