import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/design-system';
import { pushBackLayer } from '@/design-system/Sheet';
import { isNative } from '@/app/native';

interface TourStep {
  path: string;
  /** Valor de `data-tour` do elemento destacado; sem ele, o cartão fica no centro. */
  target?: string;
  title: string;
  text: string;
}

const STEPS: TourStep[] = [
  isNative
    ? {
        path: '/',
        target: 'scan',
        title: 'Escaneie a nota fiscal',
        text: 'Aponte a câmera para o QR Code do cupom. O Precivora cadastra o lugar, os produtos e os preços pagos de uma vez só.',
      }
    : {
        path: '/',
        target: 'scan',
        title: 'Registre os preços',
        text: 'Anote o preço que viu na prateleira ou registre uma compra. Cada registro alimenta as comparações.',
      },
  {
    path: '/',
    target: 'shortcuts',
    title: 'Atalhos',
    text: 'Anote um preço da prateleira, o preço da bomba do posto ou uma compra sem nota em poucos toques.',
  },
  {
    path: '/comparar',
    target: 'nav-comparar',
    title: 'Comparar',
    text: 'Veja onde cada produto está mais barato, com preço por quilo ou litro e suas avaliações.',
  },
  {
    path: '/listas',
    target: 'nav-listas',
    title: 'Listas',
    text: 'Monte a lista de compras e o app calcula quanto ela custa em cada lugar, até dividindo entre mercados.',
  },
  {
    path: '/historico',
    target: 'nav-historico',
    title: 'Histórico',
    text: 'Suas compras, quanto gastou no mês e quanto economizou em relação à sua média.',
  },
  {
    path: '/mais',
    target: 'nav-mais',
    title: 'Mais',
    text: 'Lugares, produtos, combustíveis, orçamento, backup e ajustes ficam aqui.',
  },
  {
    path: '/',
    title: 'Tudo pronto',
    text: 'Seus dados ficam só neste aparelho. Faça um backup de vez em quando em Mais → Backup. Você pode rever esta apresentação nos Ajustes.',
  },
];

const PAD = 8;

function findTarget(name: string): HTMLElement | null {
  const all = [...document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)];
  return all.find((el) => el.offsetParent !== null && el.getBoundingClientRect().width > 0) ?? null;
}

/** Apresentação guiada: passa pelas telas destacando cada parte. Bloqueia o resto da tela enquanto está aberta. */
export function Tour({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const step = STEPS[index];
  const last = index === STEPS.length - 1;

  const measure = useCallback(() => {
    if (!step.target) return setRect(null);
    const el = findTarget(step.target);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [step.target]);

  useEffect(() => {
    navigate(step.path);
    let tries = 0;
    let timer = 0;
    const locate = () => {
      const el = step.target ? findTarget(step.target) : null;
      if (step.target && !el && tries++ < 20) {
        timer = window.setTimeout(locate, 80);
        return;
      }
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: 'center' });
      }
      requestAnimationFrame(measure);
    };
    timer = window.setTimeout(locate, 60);
    return () => window.clearTimeout(timer);
  }, [index, step.path, step.target, navigate, measure]);

  useEffect(() => {
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [measure]);

  useEffect(() => pushBackLayer(onDone), [onDone]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDone();
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(STEPS.length - 1, i + 1));
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onDone]);

  useLayoutEffect(() => {
    cardRef.current?.querySelector<HTMLElement>('[data-tour-primary]')?.focus();
  }, [index]);

  const vh = typeof window === 'undefined' ? 800 : window.innerHeight;
  const below = rect ? rect.top + rect.height / 2 < vh / 2 : false;
  const cardPos: React.CSSProperties = !rect
    ? { top: '50%', transform: 'translateY(-50%)' }
    : below
      ? { top: Math.min(rect.bottom + PAD + 12, vh - 220) }
      : { bottom: Math.max(vh - rect.top + PAD + 12, 16) };

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-text">
      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-xl transition-all duration-300 ease-out"
          style={{
            left: rect.left - PAD,
            top: rect.top - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: '0 0 0 2px #A3E635, 0 0 0 9999px rgba(8, 13, 24, 0.74)',
          }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-[rgba(8,13,24,0.74)]" />
      )}
      <div ref={cardRef} className="absolute inset-x-4 mx-auto max-w-sm transition-[top,bottom] duration-300" style={cardPos}>
      <div key={index} className="animate-pop-in rounded-2xl bg-surface p-5 shadow-float">
        <div className="mb-3 flex items-center gap-1.5" aria-hidden>
          {STEPS.map((_, i) => (
            <span key={i} className={i === index ? 'h-1.5 w-5 rounded-full bg-lime-ink dark:bg-lime' : 'h-1.5 w-1.5 rounded-full bg-line'} />
          ))}
        </div>
        <h2 id="tour-title" className="text-lg font-bold">
          {step.title}
        </h2>
        <p id="tour-text" className="mt-1.5 text-sm text-muted">
          {step.text}
        </p>
        <p className="sr-only" aria-live="polite">
          Passo {index + 1} de {STEPS.length}
        </p>
        <div className="mt-4 flex items-center gap-2">
          {!last && (
            <Button variant="ghost" size="sm" onClick={onDone}>
              Pular
            </Button>
          )}
          <span className="flex-1" />
          {index > 0 && (
            <Button variant="secondary" size="sm" onClick={() => setIndex((i) => i - 1)}>
              Voltar
            </Button>
          )}
          <Button size="sm" data-tour-primary onClick={() => (last ? onDone() : setIndex((i) => i + 1))}>
            {last ? 'Começar a usar' : 'Próximo'}
          </Button>
        </div>
      </div>
      </div>
    </div>
  );
}
