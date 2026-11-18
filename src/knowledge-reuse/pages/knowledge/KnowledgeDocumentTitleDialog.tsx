import { useEffect, useId, useState, type FormEvent } from 'react';
import {
  KNOWLEDGE_DOCUMENT_TITLE_MAX_LENGTH,
  validateKnowledgeDocumentTitle,
} from './knowledge-document-title';

export default function KnowledgeDocumentTitleDialog({
  mode,
  initialTitle = '',
  parentTitle,
  busy,
  error,
  onClose,
  onInputChange,
  onSubmit,
}: {
  mode: 'create' | 'rename';
  initialTitle?: string;
  parentTitle?: string;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onInputChange?: () => void;
  onSubmit: (title: string) => void | Promise<void>;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const inputId = useId();
  const errorId = useId();
  const [title, setTitle] = useState(initialTitle);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape' && !busy) onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [busy, onClose]);

  function changeTitle(value: string) {
    setTitle(value);
    setLocalError('');
    onInputChange?.();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const validation = validateKnowledgeDocumentTitle(title);
    if (validation.error) {
      setLocalError(validation.error);
      return;
    }
    void onSubmit(validation.value);
  }

  const isCreate = mode === 'create';
  const displayedError = localError || error || '';

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-ink-900/40 p-4"
      onMouseDown={() => { if (!busy) onClose(); }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="card w-full max-w-lg overflow-hidden shadow-xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink-200 px-6 py-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-ink-900">
              {isCreate ? '新建知识文档' : '重命名知识文档'}
            </h2>
            <p id={descriptionId} className="mt-1 text-sm leading-6 text-ink-500">
              {isCreate
                ? '使用清晰、可检索的标题创建草稿；新文档将进入待审核区。'
                : '只修改文章标题，不会改变正文、层级和审核状态。'}
            </p>
          </div>
          <button
            type="button"
            aria-label="关闭弹窗"
            className="rounded-lg px-2 py-1 text-ink-400 hover:bg-ink-50 hover:text-ink-700"
            onClick={onClose}
            disabled={busy}
          >
            ✕
          </button>
        </div>

        <form className="space-y-4 px-6 py-5" onSubmit={submit}>
          {isCreate && parentTitle && (
            <div className="rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 text-sm text-ink-600">
              新文档位置：<span className="font-medium text-ink-800">{parentTitle}</span> 下
            </div>
          )}
          <div>
            <label className="label" htmlFor={inputId}>文章标题</label>
            <input
              id={inputId}
              className="input"
              value={title}
              maxLength={KNOWLEDGE_DOCUMENT_TITLE_MAX_LENGTH}
              onChange={(event) => changeTitle(event.target.value)}
              placeholder="如：重复经颅磁刺激治疗抑郁症的研究进展"
              autoFocus
              disabled={busy}
              aria-invalid={!!displayedError}
              aria-describedby={displayedError ? errorId : descriptionId}
            />
            <div className="mt-1 flex justify-between gap-3 text-xs text-ink-400">
              <span>{isCreate ? '创建后可继续编辑正文并提交审核' : '列表、检索结果和引用标题会同步更新'}</span>
              <span className="shrink-0">{title.length}/{KNOWLEDGE_DOCUMENT_TITLE_MAX_LENGTH}</span>
            </div>
          </div>

          {displayedError && (
            <div id={errorId} role="alert" className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
              {displayedError}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-ink-100 pt-4">
            <button type="button" className="btn-outline" onClick={onClose} disabled={busy}>取消</button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? (isCreate ? '创建中…' : '保存中…') : (isCreate ? '创建文档' : '保存标题')}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

