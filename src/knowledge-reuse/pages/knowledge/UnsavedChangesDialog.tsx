import { useEffect, useId } from 'react';

export default function UnsavedChangesDialog({
  currentDocumentTitle,
  targetLabel,
  onCancel,
  onDiscard,
}: {
  currentDocumentTitle: string;
  targetLabel: string;
  onCancel: () => void;
  onDiscard: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-ink-900/40 p-4"
      onMouseDown={onCancel}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="card w-full max-w-md overflow-hidden shadow-xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-ink-200 px-6 py-4">
          <div aria-hidden="true" className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-700">
            !
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-semibold text-ink-900">有未保存的修改</h2>
            <p id={descriptionId} className="mt-1 text-sm leading-6 text-ink-500">
              “{currentDocumentTitle || '当前文档'}”中的修改尚未保存。{targetLabel}后，这些修改将丢失。
            </p>
          </div>
          <button
            type="button"
            aria-label="关闭弹窗并继续编辑"
            className="rounded-lg px-2 py-1 text-ink-400 hover:bg-ink-50 hover:text-ink-700"
            onClick={onCancel}
          >
            ✕
          </button>
        </div>
        <div className="flex flex-col-reverse gap-2 px-6 py-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:border-red-300 hover:bg-red-50"
            onClick={onDiscard}
          >
            放弃修改并切换
          </button>
          <button type="button" className="btn-primary" onClick={onCancel} autoFocus>
            继续编辑
          </button>
        </div>
      </section>
    </div>
  );
}

