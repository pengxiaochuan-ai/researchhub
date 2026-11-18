import { useEffect } from 'react';

export default function KnowledgeDocumentDeleteDialog({
  title,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  title: string;
  busy: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink-900/40 p-4"
      onMouseDown={() => {
        if (!busy) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-knowledge-document-title"
        className="card w-full max-w-md overflow-hidden shadow-xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="border-b border-ink-200 px-6 py-4">
          <h2 id="delete-knowledge-document-title" className="text-lg font-semibold text-ink-900">
            移入回收站
          </h2>
          <p className="mt-1 text-sm leading-6 text-ink-500">
            文档及其子文档将停止被检索，30 天内可以恢复。
          </p>
        </div>
        <div className="space-y-4 px-6 py-5">
          <div className="rounded-xl border border-ink-200 bg-ink-50 px-4 py-3 font-medium text-ink-800">
            {title}
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-800">
            此操作会同时移入全部子文档；恢复时也会按同一批次整体恢复。
          </div>
          {error && (
            <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 border-t border-ink-100 pt-4">
            <button type="button" className="btn-outline" disabled={busy} onClick={onClose}>
              取消
            </button>
            <button
              type="button"
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              disabled={busy}
              onClick={onConfirm}
            >
              {busy ? '处理中…' : '确认移入回收站'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

