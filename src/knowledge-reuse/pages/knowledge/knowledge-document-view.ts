import type { WikiMode } from './WikiEditor';

export interface KnowledgeSourceFileMeta {
  filename: string;
  extension: string;
  contentType: string;
  size: number;
}

export type KnowledgeDocumentView = 'original' | WikiMode;

export function defaultKnowledgeDocumentView(
  sourceFile: Pick<KnowledgeSourceFileMeta, 'extension' | 'contentType'> | null | undefined,
  canEdit: boolean,
): KnowledgeDocumentView {
  if (sourceFile) return 'original';
  return canEdit ? 'wysiwyg' : 'preview';
}

export function isInlineKnowledgeSource(contentType: string): boolean {
  return contentType === 'application/pdf' || /^image\/(?:png|jpeg|webp)$/.test(contentType);
}

