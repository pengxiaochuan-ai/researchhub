export interface KnowledgeTrashItem {
  id: string;
  title: string;
  trashReason: string | null;
  trashedAt: string;
  purgeAfter: string;
  trashBatchId: string | null;
}

export interface KnowledgeTrashGroup {
  batchId: string;
  representativeId: string;
  items: KnowledgeTrashItem[];
  trashedAt: string;
  purgeAfter: string;
  reason: string | null;
}

export function groupKnowledgeTrashItems(
  items: readonly KnowledgeTrashItem[],
): KnowledgeTrashGroup[] {
  const groups = new Map<string, KnowledgeTrashItem[]>();
  for (const item of items) {
    const batchId = item.trashBatchId || `single:${item.id}`;
    groups.set(batchId, [...(groups.get(batchId) ?? []), item]);
  }
  return [...groups.entries()].map(([batchId, groupItems]) => ({
    batchId,
    representativeId: groupItems[0].id,
    items: groupItems,
    trashedAt: groupItems[0].trashedAt,
    purgeAfter: groupItems[0].purgeAfter,
    reason: groupItems[0].trashReason,
  }));
}

