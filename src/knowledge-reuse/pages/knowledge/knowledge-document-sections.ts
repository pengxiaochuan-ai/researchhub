export interface KnowledgeTreeNode {
  id: string;
  title: string;
  parentId?: string | null;
  order: number;
  status: string;
  reviewed: boolean;
  safetyLevel?: 'allow' | 'warning' | 'blocked';
  safetyCodes?: string[];
  children?: KnowledgeTreeNode[];
}

export interface PendingKnowledgeDocument {
  node: KnowledgeTreeNode;
  parentPath: string;
}

export function partitionKnowledgeTree(nodes: KnowledgeTreeNode[]): {
  pending: PendingKnowledgeDocument[];
  reviewedTree: KnowledgeTreeNode[];
} {
  const pending: PendingKnowledgeDocument[] = [];

  function visit(
    currentNodes: KnowledgeTreeNode[],
    parentTitles: string[],
  ): KnowledgeTreeNode[] {
    return currentNodes.flatMap((node) => {
      if (!node.reviewed) {
        pending.push({
          node: { ...node, children: undefined },
          parentPath: parentTitles.join(' / '),
        });
        const reviewedChildren = visit(node.children || [], [...parentTitles, node.title]);
        return reviewedChildren;
      }

      const reviewedChildren = visit(node.children || [], [...parentTitles, node.title]);
      return [{ ...node, children: reviewedChildren }];
    });
  }

  return {
    pending,
    reviewedTree: visit(nodes, []),
  };
}

