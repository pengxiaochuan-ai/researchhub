import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../api/client';
import { useSystemDialog } from '../../components/SystemDialogProvider';
import Markdown from '../../components/Markdown';

/* 文档历史版本抽屉（K8 缺口#3）。
 * 🔴 真实后端 listVersions 只返回元信息：{ id, version, title, editedBy, createdAt }（无 contentMd）。
 *    故「查看」默认只展开元信息；若后端某天在版本对象带上 contentMd，这里会自动渲染 Markdown 预览。 */

export interface DocVersion {
  id: string;
  version: number;
  title: string;
  editedBy?: string | null;
  createdAt: string;
  contentMd?: string; // 后端当前不返回；有则预览
}

function fmt(ts: string): string {
  const d = new Date(ts);
  return isNaN(d.getTime()) ? ts : d.toLocaleString('zh-CN', { hour12: false });
}

export default function VersionDrawer({
  docId,
  canEdit,
  onClose,
  onReverted,
}: {
  docId: string;
  canEdit: boolean;
  onClose: () => void;
  onReverted: (version: number) => void | Promise<void>;
}) {
  const [versions, setVersions] = useState<DocVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [openId, setOpenId] = useState(''); // 展开查看的版本 id
  const [reverting, setReverting] = useState<number | null>(null);
  const { askConfirmation } = useSystemDialog();

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      setVersions(await api.get<DocVersion[]>(`/knowledge/docs/${docId}/versions`));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : '加载版本失败');
    } finally {
      setLoading(false);
    }
  }, [docId]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape' && reverting === null) onClose(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose, reverting]);

  async function revert(version: number) {
    const ok = await askConfirmation({
      title: '确认回滚版本',
      message: `回滚到版本 v${version}？当前正文会先自动存为一个新版本，可再回滚。`,
      confirmLabel: '回滚',
      tone: 'warning',
    });
    if (!ok) return;
    setReverting(version);
    setErr('');
    try {
      await api.post(`/knowledge/docs/${docId}/revert`, { version });
      await onReverted(version);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : '回滚失败');
    } finally {
      setReverting(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink-900/40" onMouseDown={onClose}>
      <div
        role="dialog" aria-modal="true" aria-label="历史版本"
        className="flex h-full w-full max-w-md flex-col bg-white shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-ink-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-ink-900">历史版本</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700" title="关闭">
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="grid place-items-center py-16 text-sm text-ink-400">加载中…</div>
          ) : err ? (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</div>
          ) : versions.length === 0 ? (
            <div className="grid place-items-center py-16 text-center text-sm text-ink-400">
              暂无历史版本
              <br />
              （正文首次修改后才会产生快照）
            </div>
          ) : (
            <ul className="space-y-2">
              {versions.map((v) => {
                const open = openId === v.id;
                return (
                  <li key={v.id} className="rounded-lg border border-ink-200">
                    <div className="flex items-center gap-2 px-3 py-2">
                      <span className="shrink-0 rounded bg-ink-100 px-1.5 py-0.5 text-xs font-semibold text-ink-700">
                        v{v.version}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-ink-800">{v.title}</div>
                        <div className="truncate text-xs text-ink-400">
                          {fmt(v.createdAt)}
                          {v.editedBy ? ` · ${v.editedBy}` : ''}
                        </div>
                      </div>
                      <button
                        onClick={() => setOpenId(open ? '' : v.id)}
                        className="btn-outline shrink-0 px-2 py-1 text-xs"
                      >
                        {open ? '收起' : '查看'}
                      </button>
                      {canEdit && (
                        <button
                          onClick={() => void revert(v.version)}
                          disabled={reverting !== null}
                          className="btn-primary shrink-0 px-2 py-1 text-xs"
                        >
                          {reverting === v.version ? '回滚中…' : '回滚'}
                        </button>
                      )}
                    </div>
                    {open && (
                      <div className="border-t border-ink-100 px-3 py-2">
                        {v.contentMd != null ? (
                          <div className="max-h-72 overflow-y-auto">
                            <Markdown>{v.contentMd}</Markdown>
                          </div>
                        ) : (
                          <div className="text-xs text-ink-400">
                            该版本仅保留元信息（版本号 / 标题 / 时间 / 编辑者）。如需查看正文，请
                            {canEdit ? '「回滚到此版本」后在编辑区查看' : '联系可写此库的成员回滚查看'}。
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

