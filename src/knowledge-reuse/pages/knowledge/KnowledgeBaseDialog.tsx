import { useEffect, useId, useState, type FormEvent } from 'react';
import { validateKnowledgeBaseName } from './knowledge-base-management';

export type KnowledgeBaseVisibility = 'private' | 'tenant';

export default function KnowledgeBaseDialog({
  mode,
  initialName = '',
  initialVisibility = 'private',
  canCreateTenantBase,
  busy,
  error,
  onClose,
  onInputChange,
  onSubmit,
}: {
  mode: 'create' | 'edit';
  initialName?: string;
  initialVisibility?: KnowledgeBaseVisibility;
  canCreateTenantBase: boolean;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onInputChange?: () => void;
  onSubmit: (input: { name: string; visibility: KnowledgeBaseVisibility }) => void | Promise<void>;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const [name, setName] = useState(initialName);
  const [visibility, setVisibility] = useState<KnowledgeBaseVisibility>(
    canCreateTenantBase ? initialVisibility : 'private',
  );
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape' && !busy) onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [busy, onClose]);

  function changeName(value: string) {
    setName(value);
    setLocalError('');
    onInputChange?.();
  }

  function changeVisibility(value: KnowledgeBaseVisibility) {
    setVisibility(value);
    onInputChange?.();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const validation = validateKnowledgeBaseName(name);
    if (validation.error) {
      setLocalError(validation.error);
      return;
    }
    void onSubmit({ name: validation.value, visibility });
  }

  const title = mode === 'create' ? '新建知识库' : '编辑知识库名称';
  const submitLabel = mode === 'create'
    ? (busy ? '创建中…' : '创建知识库')
    : (busy ? '保存中…' : '保存名称');
  const displayedError = localError || error || '';

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink-900/40 p-4"
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
            <h2 id={titleId} className="text-lg font-semibold text-ink-900">{title}</h2>
            <p id={descriptionId} className="mt-1 text-sm leading-6 text-ink-500">
              {mode === 'create'
                ? '为文献、方法和团队知识建立清晰的内容空间。创建后仍需逐篇审核文章。'
                : '修改后会同步更新科研工作区和管理后台中的知识库名称。'}
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

        <form className="space-y-5 px-6 py-5" onSubmit={submit}>
          <div>
            <label className="label" htmlFor="knowledge-base-name">知识库名称</label>
            <input
              id="knowledge-base-name"
              className="input"
              value={name}
              maxLength={80}
              onChange={(event) => changeName(event.target.value)}
              placeholder="如：抑郁症循证知识库"
              autoFocus
              disabled={busy}
              aria-invalid={!!displayedError}
              aria-describedby={displayedError ? 'knowledge-base-error' : undefined}
            />
            <div className="mt-1 flex justify-between text-xs text-ink-400">
              <span>用于列表展示，建议使用清晰、可区分的业务名称</span>
              <span>{name.length}/80</span>
            </div>
          </div>

          {mode === 'create' && (
            <fieldset>
              <legend className="label">可见范围</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {canCreateTenantBase && (
                  <label className={`cursor-pointer rounded-xl border p-3 transition ${visibility === 'tenant' ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-200' : 'border-ink-200 hover:border-ink-300'}`}>
                    <input
                      type="radio"
                      name="knowledge-base-visibility"
                      value="tenant"
                      checked={visibility === 'tenant'}
                      onChange={() => changeVisibility('tenant')}
                      className="sr-only"
                      disabled={busy}
                    />
                    <span className="block text-sm font-semibold text-ink-800">租户共享</span>
                    <span className="mt-1 block text-xs leading-5 text-ink-500">由租户管理员维护，可按知识库分配规则供科研人员使用。</span>
                  </label>
                )}
                <label className={`cursor-pointer rounded-xl border p-3 transition ${visibility === 'private' ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-200' : 'border-ink-200 hover:border-ink-300'}`}>
                  <input
                    type="radio"
                    name="knowledge-base-visibility"
                    value="private"
                    checked={visibility === 'private'}
                    onChange={() => changeVisibility('private')}
                    className="sr-only"
                    disabled={busy}
                  />
                  <span className="block text-sm font-semibold text-ink-800">我的个人库</span>
                  <span className="mt-1 block text-xs leading-5 text-ink-500">仅当前账号可见和编辑，适合个人整理中的文献与草稿。</span>
                </label>
              </div>
            </fieldset>
          )}

          {displayedError && (
            <div id="knowledge-base-error" role="alert" className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
              {displayedError}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-ink-100 pt-4">
            <button type="button" className="btn-outline" onClick={onClose} disabled={busy}>取消</button>
            <button type="submit" className="btn-primary" disabled={busy}>{submitLabel}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

