import { Star } from 'lucide-react';
import { cx } from './cx';

export function Stars({ value, size = 14, className, label }: { value?: number; size?: number; className?: string; label?: string }) {
  const v = value ?? 0;
  return (
    <span
      className={cx('inline-flex items-center gap-0.5', className)}
      role="img"
      aria-label={label ?? (value ? `${v.toFixed(1).replace('.', ',')} de 5 estrelas` : 'Sem avaliação')}
    >
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, v - (i - 1)));
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }} aria-hidden>
            <Star className="absolute inset-0 text-line" style={{ width: size, height: size }} fill="currentColor" strokeWidth={0} />
            {fill > 0 && (
              <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star className="text-amber-400" style={{ width: size, height: size }} fill="currentColor" strokeWidth={0} />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

export function StarInput({
  value,
  onChange,
  label,
  optional,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  optional?: boolean;
}) {
  const words = ['', 'Ruim', 'Fraco', 'Ok', 'Bom', 'Ótimo'];
  return (
    <fieldset className="flex items-center justify-between gap-3">
      <legend className="sr-only">{label}</legend>
      <span className="text-[15px] font-semibold" aria-hidden>
        {label}
        {optional && <span className="text-sm font-normal text-muted"> (opcional)</span>}
      </span>
      <div className="flex items-center gap-2">
        <span className="w-12 text-right text-xs text-muted" aria-live="polite">
          {words[value] ?? ''}
        </span>
        <div
          role="radiogroup"
          aria-label={label}
          className="flex"
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
              e.preventDefault();
              onChange(Math.min(5, value + 1));
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
              e.preventDefault();
              onChange(Math.max(optional ? 0 : 1, value - 1));
            }
          }}
        >
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={value === i}
              aria-label={`${i} estrela${i > 1 ? 's' : ''}`}
              tabIndex={value === i || (value === 0 && i === 1) ? 0 : -1}
              onClick={() => onChange(optional && value === i ? 0 : i)}
              className="flex h-10 w-9 items-center justify-center"
            >
              <Star
                className={cx('h-7 w-7 transition-transform active:scale-90', i <= value ? 'text-amber-400' : 'text-line')}
                fill="currentColor"
                strokeWidth={0}
              />
            </button>
          ))}
        </div>
      </div>
    </fieldset>
  );
}
