import {
  createContext,
  type FormEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

type SystemDialogTone = 'default' | 'warning' | 'danger';

interface DialogBaseOptions {
  title: string;
  message: string;
  detail?: string;
  confirmLabel?: string;
  tone?: SystemDialogTone;
  dismissible?: boolean;
}

export interface ConfirmationDialogOptions extends DialogBaseOptions {
  cancelLabel?: string;
}

export interface TextDialogOptions extends DialogBaseOptions {
  cancelLabel?: string;
  defaultValue?: string;
  inputLabel?: string;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  validate?: (value: string) => string | null;
}

export type NoticeDialogOptions = DialogBaseOptions;

interface SystemDialogApi {
  askConfirmation: (options: ConfirmationDialogOptions) => Promise<boolean>;
  requestText: (options: TextDialogOptions) => Promise<string | null>;
  showNotice: (options: NoticeDialogOptions) => Promise<void>;
}

type DialogRequest =
  | ({ id: number; kind: 'confirmation'; resolve: (value: boolean) => void } & ConfirmationDialogOptions)
  | ({ id: number; kind: 'text'; resolve: (value: string | null) => void } & TextDialogOptions)
  | ({ id: number; kind: 'notice'; resolve: () => void } & NoticeDialogOptions);

const SystemDialogContext = createContext<SystemDialogApi | null>(null);

export function useSystemDialog(): SystemDialogApi {
  const value = useContext(SystemDialogContext);
  if (!value) {
    throw new Error('useSystemDialog 必须在 SystemDialogProvider 内使用');
  }
  return value;
}

export function SystemDialogProvider({ children }: { children: ReactNode }) {
  const queueRef = useRef<DialogRequest[]>([]);
  const activeRef = useRef<DialogRequest | null>(null);
  const sequenceRef = useRef(0);
  const [active, setActive] = useState<DialogRequest | null>(null);

  const present = useCallback((request: DialogRequest) => {
    queueRef.current.push(request);
    if (activeRef.current) return;
    const next = queueRef.current.shift() ?? null;
    activeRef.current = next;
    setActive(next);
  }, []);

  const finish = useCallback((value?: boolean | string | null) => {
    const current = activeRef.current;
    if (!current) return;
    if (current.kind === 'confirmation') current.resolve(value === true);
    else if (current.kind === 'text') current.resolve(typeof value === 'string' ? value : null);
    else current.resolve();

    const next = queueRef.current.shift() ?? null;
    activeRef.current = next;
    setActive(next);
  }, []);

  const askConfirmation = useCallback(
    (options: ConfirmationDialogOptions) =>
      new Promise<boolean>((resolve) => {
        present({ ...options, id: ++sequenceRef.current, kind: 'confirmation', resolve });
      }),
    [present],
  );

  const requestText = useCallback(
    (options: TextDialogOptions) =>
      new Promise<string | null>((resolve) => {
        present({ ...options, id: ++sequenceRef.current, kind: 'text', resolve });
      }),
    [present],
  );

  const showNotice = useCallback(
    (options: NoticeDialogOptions) =>
      new Promise<void>((resolve) => {
        present({ ...options, id: ++sequenceRef.current, kind: 'notice', resolve });
      }),
    [present],
  );

  const api = useMemo(
    () => ({ askConfirmation, requestText, showNotice }),
    [askConfirmation, requestText, showNotice],
  );

  return (
    <SystemDialogContext.Provider value={api}>
      {children}
      {active && <SystemDialog request={active} onFinish={finish} />}
    </SystemDialogContext.Provider>
  );
}

function SystemDialog({
  request,
  onFinish,
}: {
  request: DialogRequest;
  onFinish: (value?: boolean | string | null) => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [inputValue, setInputValue] = useState(
    request.kind === 'text' ? request.defaultValue ?? '' : '',
  );
  const [inputError, setInputError] = useState('');
  const dismissible = request.dismissible !== false;

  const cancel = useCallback(() => {
    if (request.kind === 'notice') onFinish();
    else if (request.kind === 'text') onFinish(null);
    else onFinish(false);
  }, [onFinish, request.kind]);

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const frame = window.requestAnimationFrame(() => {
      if (request.kind === 'text') inputRef.current?.focus();
      else confirmRef.current?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
      previousFocusRef.current?.focus();
    };
  }, [request.id, request.kind]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && dismissible) {
        event.preventDefault();
        cancel();
        return;
      }
      if (event.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cancel, dismissible]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (request.kind === 'text') {
      const requiredError = request.required && !inputValue.trim()
        ? `请输入${request.inputLabel || '内容'}`
        : null;
      const validationError = requiredError ?? request.validate?.(inputValue) ?? null;
      if (validationError) {
        setInputError(validationError);
        inputRef.current?.focus();
        return;
      }
      onFinish(inputValue);
      return;
    }
    if (request.kind === 'confirmation') onFinish(true);
    else onFinish();
  }

  const tone = request.tone ?? 'default';
  const toneStyles = {
    default: {
      icon: 'bg-brand-50 text-brand-700 ring-brand-100',
      button: 'bg-brand-600 hover:bg-brand-700 focus-visible:ring-brand-200',
      symbol: 'i',
    },
    warning: {
      icon: 'bg-amber-50 text-amber-700 ring-amber-100',
      button: 'bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-200',
      symbol: '!',
    },
    danger: {
      icon: 'bg-red-50 text-red-700 ring-red-100',
      button: 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-200',
      symbol: '!',
    },
  }[tone];
  const titleId = `system-dialog-title-${request.id}`;
  const descriptionId = `system-dialog-description-${request.id}`;

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-ink-900/45 p-4 backdrop-blur-[1px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && dismissible) cancel();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="card w-full max-w-md overflow-hidden border border-white/70 shadow-2xl shadow-ink-900/20"
      >
        <form onSubmit={submit}>
          <div className="flex items-start gap-3 px-6 pb-4 pt-5">
            <div
              aria-hidden="true"
              className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ring-1 ${toneStyles.icon}`}
            >
              {toneStyles.symbol}
            </div>
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-base font-semibold text-ink-900">
                {request.title}
              </h2>
              <p id={descriptionId} className="mt-1.5 whitespace-pre-line text-sm leading-6 text-ink-600">
                {request.message}
              </p>
              {request.detail && (
                <div className="mt-3 rounded-lg border border-ink-100 bg-ink-50 px-3 py-2 text-xs leading-5 text-ink-500">
                  {request.detail}
                </div>
              )}
              {request.kind === 'text' && (
                <label className="mt-4 block">
                  <span className="label">{request.inputLabel ?? '请输入内容'}</span>
                  <input
                    ref={inputRef}
                    className="input h-10"
                    value={inputValue}
                    maxLength={request.maxLength ?? 500}
                    placeholder={request.placeholder}
                    aria-invalid={Boolean(inputError)}
                    aria-describedby={inputError ? `${descriptionId}-error` : undefined}
                    onChange={(event) => {
                      setInputValue(event.target.value);
                      if (inputError) setInputError('');
                    }}
                  />
                  {inputError && (
                    <span id={`${descriptionId}-error`} role="alert" className="mt-1.5 block text-xs text-red-600">
                      {inputError}
                    </span>
                  )}
                </label>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-ink-100 bg-ink-50/70 px-6 py-3.5">
            {request.kind !== 'notice' && (
              <button type="button" className="btn-outline" onClick={cancel}>
                {request.cancelLabel ?? '取消'}
              </button>
            )}
            <button
              ref={confirmRef}
              type="submit"
              className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition focus-visible:outline-none focus-visible:ring-4 ${toneStyles.button}`}
            >
              {request.confirmLabel ?? (request.kind === 'notice' ? '知道了' : '确定')}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

