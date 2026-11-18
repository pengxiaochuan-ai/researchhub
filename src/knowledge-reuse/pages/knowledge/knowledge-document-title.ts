export const KNOWLEDGE_DOCUMENT_TITLE_MAX_LENGTH = 160;

export function validateKnowledgeDocumentTitle(title: string): {
  value: string;
  error: string;
} {
  const value = title.trim();
  if (!value) return { value, error: '知识文档标题不能为空' };
  if (value.length > KNOWLEDGE_DOCUMENT_TITLE_MAX_LENGTH) {
    return {
      value,
      error: `知识文档标题最多 ${KNOWLEDGE_DOCUMENT_TITLE_MAX_LENGTH} 个字符`,
    };
  }
  return { value, error: '' };
}

