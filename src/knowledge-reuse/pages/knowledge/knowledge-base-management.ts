export interface ManageableKnowledgeBase {
  id: string;
  canManage?: boolean;
}

export type KnowledgeBaseMoveDirection = 'up' | 'down';

export function validateKnowledgeBaseName(name: string): {
  value: string;
  error: string;
} {
  const value = name.trim();
  if (!value) return { value, error: '知识库名称不能为空' };
  if (value.length > 80) return { value, error: '知识库名称最多 80 个字符' };
  return { value, error: '' };
}

export function moveManageableBaseIds(
  bases: ManageableKnowledgeBase[],
  currentId: string,
  direction: KnowledgeBaseMoveDirection,
): string[] {
  const ids = bases.filter((base) => base.canManage).map((base) => base.id);
  const currentIndex = ids.indexOf(currentId);
  if (currentIndex < 0) return ids;
  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= ids.length) return ids;
  [ids[currentIndex], ids[targetIndex]] = [ids[targetIndex], ids[currentIndex]];
  return ids;
}

export function deleteKnowledgeBaseState(docCount: number): {
  blocked: boolean;
  message: string;
} {
  if (docCount > 0) {
    return {
      blocked: true,
      message: `库内仍有 ${docCount} 篇文章。请先删除或迁移文章，再删除知识库。`,
    };
  }
  return {
    blocked: false,
    message: '该知识库为空，可以删除。删除后不可恢复。',
  };
}

