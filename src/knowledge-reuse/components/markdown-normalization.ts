/**
 * GFM 会把一行中两个独立的 `~` 误连成删除线。
 * 科研报告常用 `30~33` 表示数值范围，渲染前统一换成不歧义的 en dash。
 */
export function normalizeResearchMarkdown(markdown: string): string {
  return markdown.replace(
    /(\d[\d,.]*)\s*~\s*(\d[\d,.]*)/g,
    '$1–$2',
  );
}

