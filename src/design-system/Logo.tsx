import { cx } from './cx';

export function LogoSymbol({ className, accentClass = 'text-lime-ink' }: { className?: string; accentClass?: string }) {
  return (
    <svg viewBox="10 8 80 84" className={className} aria-hidden>
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M27 16 H58 a6 6 0 0 1 4.3 1.8 L79.5 35.5 a6 6 0 0 1 0 8.4 L62.3 61.6 a6 6 0 0 1 -4.3 1.8 H41 V76 a8 8 0 0 1 -8 8 h-0 a8 8 0 0 1 -8 -8 V24 a8 8 0 0 1 8 -8 Z M63.5 39.7 m-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 Z"
      />
      <g className={accentClass} fill="none" stroke="currentColor" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M50 70 L60 80 L68 72 L80 84" />
        <path d="M70 84 H80 V74" />
      </g>
    </svg>
  );
}

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cx('inline-flex items-center gap-2 text-ink', className)}>
      <LogoSymbol className="h-8 w-8" />
      {!compact && (
        <span className="font-display text-[22px] font-bold leading-none tracking-[-0.04em]" aria-label="Precivora">
          precivora
        </span>
      )}
    </span>
  );
}
