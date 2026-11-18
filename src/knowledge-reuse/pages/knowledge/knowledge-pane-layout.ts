export type KnowledgePaneSide = 'left' | 'right';

export interface KnowledgePaneWidths {
  left: number;
  right: number;
}

export interface KnowledgePaneLayout extends KnowledgePaneWidths {
  center: number;
}

export const KNOWLEDGE_PANE_STORAGE_KEY = 'aisci:knowledge-pane-widths:v1';
export const DEFAULT_KNOWLEDGE_PANE_WIDTHS: Readonly<KnowledgePaneWidths> = {
  left: 280,
  right: 360,
};

export const KNOWLEDGE_PANE_LIMITS = {
  left: { min: 220, max: 420 },
  right: { min: 300, max: 480 },
  centerMin: 480,
  separators: 12,
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function finiteWidth(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function parseStoredKnowledgePaneWidths(raw: string | null): KnowledgePaneWidths {
  if (!raw) return { ...DEFAULT_KNOWLEDGE_PANE_WIDTHS };
  try {
    const parsed = JSON.parse(raw) as Partial<KnowledgePaneWidths>;
    if (!finiteWidth(parsed.left) || !finiteWidth(parsed.right)) {
      return { ...DEFAULT_KNOWLEDGE_PANE_WIDTHS };
    }
    return { left: parsed.left, right: parsed.right };
  } catch {
    return { ...DEFAULT_KNOWLEDGE_PANE_WIDTHS };
  }
}

export function getKnowledgePaneRange(
  side: KnowledgePaneSide,
  containerWidth: number,
  panes: KnowledgePaneWidths,
) {
  const limits = KNOWLEDGE_PANE_LIMITS[side];
  const oppositeWidth = side === 'left' ? panes.right : panes.left;
  const available = Math.max(
    0,
    Math.floor(containerWidth)
      - KNOWLEDGE_PANE_LIMITS.separators
      - KNOWLEDGE_PANE_LIMITS.centerMin
      - oppositeWidth,
  );
  const max = Math.max(0, Math.min(limits.max, available));
  return {
    min: Math.min(limits.min, max),
    max,
  };
}

export function normalizeKnowledgePaneWidths(
  requested: KnowledgePaneWidths,
  containerWidth: number,
): KnowledgePaneLayout {
  let left = clamp(
    finiteWidth(requested.left) ? requested.left : DEFAULT_KNOWLEDGE_PANE_WIDTHS.left,
    KNOWLEDGE_PANE_LIMITS.left.min,
    KNOWLEDGE_PANE_LIMITS.left.max,
  );
  let right = clamp(
    finiteWidth(requested.right) ? requested.right : DEFAULT_KNOWLEDGE_PANE_WIDTHS.right,
    KNOWLEDGE_PANE_LIMITS.right.min,
    KNOWLEDGE_PANE_LIMITS.right.max,
  );

  const rightRange = getKnowledgePaneRange('right', containerWidth, { left, right });
  right = clamp(right, rightRange.min, rightRange.max);

  const leftRange = getKnowledgePaneRange('left', containerWidth, { left, right });
  left = clamp(left, leftRange.min, leftRange.max);

  return {
    left,
    right,
    center: Math.max(
      0,
      Math.floor(containerWidth)
        - KNOWLEDGE_PANE_LIMITS.separators
        - left
        - right,
    ),
  };
}

export function moveKnowledgeSeparator(
  side: KnowledgePaneSide,
  panes: KnowledgePaneWidths,
  containerWidth: number,
  visualDelta: number,
): KnowledgePaneWidths {
  const range = getKnowledgePaneRange(side, containerWidth, panes);
  if (side === 'left') {
    return { ...panes, left: clamp(panes.left + visualDelta, range.min, range.max) };
  }
  return { ...panes, right: clamp(panes.right - visualDelta, range.min, range.max) };
}

export function getKnowledgeSeparatorKeyDelta(key: string, shiftKey: boolean): number | null {
  const step = shiftKey ? 32 : 8;
  if (key === 'ArrowLeft') return -step;
  if (key === 'ArrowRight') return step;
  return null;
}

export function resetKnowledgePaneWidth(
  side: KnowledgePaneSide,
  panes: KnowledgePaneWidths,
): KnowledgePaneWidths {
  return {
    ...panes,
    [side]: DEFAULT_KNOWLEDGE_PANE_WIDTHS[side],
  };
}

