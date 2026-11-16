import { Check } from 'lucide-react';
import { cx, inkOn } from '@/design-system';

/** Paleta categórica validada (daltonismo e contraste); a ordem é fixa e a cor acompanha o lugar. */
export const PLACE_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];

export function ColorSwatches({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">Cor de identificação</legend>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cor de identificação">
        {PLACE_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={value === c}
            aria-label={`Cor ${c}`}
            onClick={() => onChange(c)}
            className={cx('flex h-9 w-9 items-center justify-center rounded-[30%] ring-offset-2 ring-offset-surface', value === c && 'ring-2 ring-ink')}
            style={{ background: c }}
          >
            {value === c && <Check className="h-4 w-4" style={{ color: inkOn(c) }} aria-hidden />}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
