import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { Sheet } from './Sheet';
import { Button } from './Button';
import { cx } from './cx';

type ToastKind = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  action?: { label: string; onClick: () => void };
}

interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface FeedbackApi {
  toast: (message: string, kind?: ToastKind, action?: Toast['action']) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const Ctx = createContext<FeedbackApi | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback<FeedbackApi['toast']>(
    (message, kind = 'success', action) => {
      const id = ++seq.current;
      setToasts((t) => [...t.slice(-1), { id, kind, message, action }]);
      window.setTimeout(() => dismiss(id), kind === 'error' ? 6000 : action ? 5500 : 3200);
    },
    [dismiss],
  );
  const confirm = useCallback<FeedbackApi['confirm']>((opts) => new Promise((resolve) => setDialog({ ...opts, resolve })), []);
  const close = (v: boolean) => {
    dialog?.resolve(v);
    setDialog(null);
  };

  const api = useMemo(() => ({ toast, confirm }), [toast, confirm]);
  const icons = { success: CheckCircle2, error: XCircle, info: Info };

  return (
    <Ctx.Provider value={api}>
      {children}
      {createPortal(
        <div
          data-toasts className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom)+12px)] z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6"
          aria-live="polite"
          aria-atomic="false"
        >
          {toasts.map((t) => {
            const Icon = icons[t.kind];
            return (
              <div
                key={t.id}
                role={t.kind === 'error' ? 'alert' : 'status'}
                className="pointer-events-auto flex w-full max-w-sm animate-toast-in items-center gap-3 rounded-lg bg-navy px-4 py-3 text-sm text-[#F1F5F9] shadow-float dark:bg-raised"
              >
                <Icon
                  className={cx('h-5 w-5 shrink-0', t.kind === 'success' ? 'text-lime' : t.kind === 'error' ? 'text-red-300' : 'text-sky-300')}
                  aria-hidden
                />
                <span className="flex-1">{t.message}</span>
                {t.action && (
                  <button
                    className="font-bold text-lime"
                    onClick={() => {
                      t.action!.onClick();
                      dismiss(t.id);
                    }}
                  >
                    {t.action.label}
                  </button>
                )}
                <button aria-label="Fechar aviso" className="-mr-1 rounded p-1 opacity-60 hover:opacity-100" onClick={() => dismiss(t.id)}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>,
        document.body,
      )}
      <Sheet
        open={!!dialog}
        onClose={() => close(false)}
        title={dialog?.title ?? ''}
        role="alertdialog"
        footer={
          <>
            <Button variant="secondary" block onClick={() => close(false)} data-autofocus>
              {dialog?.cancelLabel ?? 'Cancelar'}
            </Button>
            <Button variant={dialog?.danger ? 'danger' : 'primary'} block onClick={() => close(true)}>
              {dialog?.confirmLabel ?? 'Confirmar'}
            </Button>
          </>
        }
      >
        <div className="flex gap-3">
          {dialog?.danger && <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden />}
          <div className="text-[15px] text-muted">{dialog?.message}</div>
        </div>
      </Sheet>
    </Ctx.Provider>
  );
}

export function useFeedback(): FeedbackApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useFeedback fora do FeedbackProvider');
  return v;
}
