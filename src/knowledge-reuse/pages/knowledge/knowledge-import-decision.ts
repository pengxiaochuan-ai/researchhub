export const DIRECT_IDENTIFIER_CONFIRMATION_REQUIRED =
  'DIRECT_IDENTIFIER_CONFIRMATION_REQUIRED';
export const DIRECT_IDENTIFIER_CONFIRMED = 'DIRECT_IDENTIFIER_CONFIRMED';
export const DIRECT_IDENTIFIER_DISCARDED = 'DIRECT_IDENTIFIER_DISCARDED';

export function importNeedsIdentifierDecision(task: {
  status: string;
  errorCode?: string | null;
}) {
  return (
    task.status === 'blocked' &&
    task.errorCode === DIRECT_IDENTIFIER_CONFIRMATION_REQUIRED
  );
}

export function isImportTaskTerminal(task: { status: string }) {
  return ['complete', 'failed', 'blocked'].includes(task.status);
}

export function directIdentifierDecisionPrompt(filename: string) {
  return [
    `文献「${filename}」检测到患者或受试者直接身份标识。`,
    '如继续保存，系统会生成带有醒目风险提示的待审核草稿；审核发布后可能被知识检索和模型使用。',
    '请确认已获得合法授权并核对数据使用范围。是否仍然保存？',
  ].join('\n\n');
}

