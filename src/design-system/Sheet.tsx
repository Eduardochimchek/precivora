import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { IconButton } from './Button';
import { cx } from './cx';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
let openCount = 0;
/** Pilha de painéis abertos: Esc (ou o voltar do Android) fecha só o do topo. */
const stack: { token: symbol; close: () => void }[] = [];

/** Registra uma camada que o voltar do Android deve fechar (ex.: a apresentação guiada). Devolve a função que a remove. */
export function pushBackLayer(close: () => void): () => void {
  const token = Symbol('layer');
  stack.push({ token, close });
  return () => {
    const i = stack.findIndex((x) => x.token === token);
    if (i >= 0) stack.splice(i, 1);
  };
}

/** Fecha o painel do topo, se houver. Usado pelo botão voltar do Android. */
export function closeTopSheet(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top.close();
  return true;
}

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
  /** Impede fechar clicando fora (ex.: formulário com alterações). */
  dismissible?: boolean;
  role?: 'dialog' | 'alertdialog';
}

/** Painel que sobe de baixo no celular e vira diálogo centralizado no desktop. */
export function Sheet({ open, onClose, title, description, children, footer, size = 'md', dismissible = true, role = 'dialog' }: SheetProps) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    openCount++;
    document.body.style.overflow = 'hidden';
    const t = window.setTimeout(() => {
      const el = panel.current;
      if (!el || el.contains(document.activeElement)) return;
      const auto = el.querySelector<HTMLElement>('[data-autofocus]');
      (auto ?? el.querySelector<HTMLElement>(FOCUSABLE) ?? el).focus();
    }, 30);
    const token = Symbol('sheet');
    stack.push({ token, close: () => onCloseRef.current() });
    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1]?.token !== token) return;
      const el = panel.current;
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
      } else if (e.key === 'Tab' && el) {
        const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((n) => n.offsetParent !== null);
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (!el.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      stack.splice(stack.findIndex((s) => s.token === token), 1);
      openCount--;
      if (openCount === 0) document.body.style.overflow = '';
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
      <div
        className="absolute inset-0 animate-fade-in bg-navy/50 backdrop-blur-[2px]"
        onClick={dismissible ? onClose : undefined}
        aria-hidden
      />
      <div
        ref={panel}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cx(
          'relative flex max-h-[92dvh] w-full animate-sheet-up flex-col rounded-t-2xl bg-surface shadow-float outline-none md:animate-pop-in md:rounded-2xl',
          size === 'lg' ? 'md:max-w-2xl' : 'md:max-w-lg',
        )}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line md:hidden" aria-hidden />
        <header className="flex items-start gap-3 px-5 pb-2 pt-3 md:pt-5">
          <div className="min-w-0 flex-1 pt-1.5">
            <h2 id={titleId} className="text-xl font-bold leading-tight">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-sm text-muted">
                {description}
              </p>
            )}
          </div>
          <IconButton label="Fechar" onClick={onClose} className="-mr-2">
            <X className="h-5 w-5" />
          </IconButton>
        </header>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-2">{children}</div>
        {footer && <footer className="flex gap-3 border-t border-line px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
