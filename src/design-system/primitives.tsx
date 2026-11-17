import type { HTMLAttributes, ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cx } from './cx';
import type { PriceChange } from '@/services/comparison';
import { signedPercent } from '@/utils/format';

export function Card({ className, as: As = 'div', ...rest }: HTMLAttributes<HTMLElement> & { as?: 'div' | 'section' | 'article' | 'li' }) {
  return <As className={cx('rounded-lg bg-surface shadow-card', className)} {...rest} />;
}

export function Section({
  title,
  action,
  children,
  className,
  id,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section className={cx('flex flex-col gap-3', className)} aria-labelledby={id}>
      <div className="flex items-end justify-between gap-3">
        <h2 id={id} className="text-lg font-bold">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

type ChipTone = 'neutral' | 'good' | 'bad' | 'warn' | 'info' | 'lime';
const tones: Record<ChipTone, string> = {
  neutral: 'bg-sunken text-muted',
  good: 'bg-success/[.12] text-lime-ink dark:bg-success/15',
  bad: 'bg-danger/10 text-danger',
  warn: 'bg-warn/[.12] text-warn',
  info: 'bg-accent/10 text-accent',
  lime: 'bg-lime text-navy',
};

export function Chip({ tone = 'neutral', className, children, icon }: { tone?: ChipTone; className?: string; children: ReactNode; icon?: ReactNode }) {
  return (
    <span className={cx('inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-xs font-semibold', tones[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('skeleton', className)} aria-hidden />;
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2" role="status" aria-label="Carregando">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg bg-surface p-4 shadow-card">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
  className,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('flex flex-col items-center rounded-xl border border-dashed border-line px-6 py-10 text-center', className)}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sunken text-accent">{icon}</div>
      <h3 className="text-lg font-bold">{title}</h3>
      {children && <p className="mt-1.5 max-w-sm text-sm text-muted">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Variação de preço: queda em verde, alta em vermelho. */
export function ChangeBadge({ change, className }: { change: PriceChange; className?: string }) {
  if (change.direction === 'same')
    return (
      <Chip className={className} icon={<Minus className="h-3 w-3" aria-hidden />}>
        Mesmo preço
      </Chip>
    );
  const down = change.direction === 'down';
  return (
    <Chip
      tone={down ? 'good' : 'bad'}
      className={className}
      icon={down ? <ArrowDownRight className="h-3.5 w-3.5" aria-hidden /> : <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />}
    >
      <span className="tnum">{signedPercent(change.pct)}</span>
      <span className="sr-only">{down ? 'mais barato' : 'mais caro'}</span>
    </Chip>
  );
}

/** Texto escuro ou claro conforme a luminância do fundo. */
export function inkOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.32 ? '#101C2C' : '#FFFFFF';
}

/** Marca colorida de mercado/posto. */
export function PlaceMark({ name, color, size = 40, logo }: { name: string; color: string; size?: number; logo?: string }) {
  const letter = name.trim()[0]?.toUpperCase() ?? '?';
  if (logo)
    return (
      <span aria-hidden className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[30%] border border-line bg-white" style={{ width: size, height: size }}>
        <img src={logo} alt="" className="h-full w-full object-cover" loading="lazy" />
      </span>
    );
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-[30%] font-display font-bold"
      style={{ width: size, height: size, background: color, fontSize: size * 0.42, color: inkOn(color) }}
    >
      {letter}
    </span>
  );
}

/**
 * Etiqueta de preço — o elemento de assinatura do Precivora.
 * `tone="best"` destaca o melhor preço com o verde-limão.
 */
export function PriceTag({
  value,
  caption,
  tone = 'plain',
  size = 'md',
  className,
}: {
  value: string;
  caption?: string;
  tone?: 'plain' | 'best' | 'navy';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const t = {
    plain: 'bg-sunken text-ink',
    best: 'bg-lime text-navy',
    navy: 'bg-navy text-[#F1F5F9] dark:bg-raised',
  }[tone];
  const s = { sm: 'h-8 pl-5 pr-2.5 text-[15px]', md: 'h-10 pl-6 pr-3 text-lg', lg: 'h-14 pl-8 pr-4 text-[28px]' }[size];
  return (
    <span className={cx('tag-shape relative inline-flex shrink-0 items-center rounded-r-md', t, s, className)}>
      <span
        aria-hidden
        className={cx(
          'absolute left-[9px] top-1/2 -translate-y-1/2 rounded-full',
          size === 'lg' ? 'h-2.5 w-2.5' : 'h-1.5 w-1.5',
          tone === 'best' ? 'bg-navy/60' : 'bg-current opacity-30',
        )}
      />
      <span className="price font-bold leading-none">{value}</span>
      {caption && <span className="ml-1 self-center text-[11px] font-semibold opacity-70">{caption}</span>}
    </span>
  );
}

export function Stat({ label, value, sub, className }: { label: string; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cx('flex flex-col gap-1', className)}>
      <span className="text-xs font-semibold text-muted">{label}</span>
      <span className="price text-xl font-bold">{value}</span>
      {sub && <span className="text-xs text-muted">{sub}</span>}
    </div>
  );
}

export function ProgressBar({ value, tone = 'ok', label }: { value: number; tone?: 'ok' | 'warn' | 'over' | 'none'; label: string }) {
  const pct = Math.max(0, Math.min(1, value));
  const color = { ok: 'bg-success', warn: 'bg-warn', over: 'bg-danger', none: 'bg-muted' }[tone];
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-sunken" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
      <div className={cx('h-full rounded-full transition-[width] duration-500', color)} style={{ width: `${pct * 100}%` }} />
    </div>
  );
}
