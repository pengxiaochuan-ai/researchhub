import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../../api/client';
import {
  groupKnowledgeTrashItems,
  type KnowledgeTrashItem,
} from './knowledge-trash';

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString('zh-CN', { hour12: false });
}

export default function KnowledgeTrashDialog({
  kbId,
  kbName,
  onClose,
  onRestored,
}: {
  kbId: string;
  kbName: string;
  onClose: () => void;
  onRestored: () => void;
}) {
  const [items, setItems] = useState<KnowledgeTrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState('');
  const [error, setError] = useState('');
  const groups = useMemo(() => groupKnowledgeTrashItems(items), [items]);

  useEffect(() => {
    let alive = true;
    api
      .get<KnowledgeTrashItem[]>(
        `/knowledge/bases/${encodeURIComponent(kbId)}/trash`,
      )
      .then((result) => {
        if (alive) setItems(result);
      })
      .catch((cause) => {
        if (alive) {
          setError(cause instanceof ApiError ? cause.message : '读取回收站失败');
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [kbId]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !restoringId) onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, restoringId]);

  async function restore(representativeId: string, batchId: string) {
    if (restoringId) return;
    setRestoringId(representativeId);
    setError('');
    try {
      await api.post(`/knowledge/docs/${encodeURIComponent(representativeId)}/restore`, {});
      setItems((current) =>
        current.filter(
          (item) => (item.trashBatchId || `single:${item.id}`) !== batchId,
        ),
      );
      onRestored();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : '恢复文档失败');
    } finally {
      setRestoringId('');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink-900/40 p-4"
      onMouseDown={() => {
        if (!restoringId) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="knowledge-trash-title"
        className="card flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden shadow-xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-ink-200 px-6 py-4">
          <div>
            <h2 id="knowledge-trash-title" className="text-lg font-semibold text-ink-900">
              知识库回收站
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              {kbName} · 删除后保留 30 天，恢复会按删除批次整体执行。
            </p>
          </div>
          <button type="button" aria-label="关闭回收站" className="text-ink-400 hover:text-ink-700" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="py-8 text-center text-sm text-ink-400">正在读取回收站…</div>
          ) : groups.length === 0 ? (
            <div className="py-8 text-center text-sm text-ink-400">回收站为空</div>
          ) : (
            <ul className="space-y-3">
              {groups.map((group) => (
                <li key={group.batchId} className="rounded-xl border border-ink-200 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-medium text-ink-800">
                        {group.items[0].title}
                        {group.items.length > 1 ? ` 等 ${group.items.length} 篇` : ''}
                      </div>
                      <div className="mt-1 text-xs text-ink-400">
                        {group.reason === 'duplicate' ? '重复文献清理' : '手动删除'}
                        {' · '}删除于 {formatDate(group.trashedAt)}
                      </div>
                      <div className="mt-1 text-xs text-amber-700">
                        可恢复至 {formatDate(group.purgeAfter)}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-outline shrink-0 px-3 py-1.5 text-xs"
                      disabled={Boolean(restoringId)}
                      onClick={() => void restore(group.representativeId, group.batchId)}
                    >
                      {restoringId === group.representativeId ? '恢复中…' : '恢复'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {error && (
            <div role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>
        <div className="flex justify-end border-t border-ink-200 px-6 py-4">
          <button type="button" className="btn-outline" disabled={Boolean(restoringId)} onClick={onClose}>
            关闭
          </button>
        </div>
      </section>
    </div>
  );
}

