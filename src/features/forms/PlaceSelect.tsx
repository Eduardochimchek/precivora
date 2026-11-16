import { Plus } from 'lucide-react';
import { Button, SelectField } from '@/design-system';
import { useSegments, useStores } from '@/hooks/useData';
import type { ID } from '@/types';
import { useActions } from './ActionsContext';

/** Escolha de lugar (segmentos de produtos), agrupado por tipo, com atalho para cadastrar. */
export function PlaceSelect({ value, onChange, error, keepId }: { value: ID | ''; onChange: (id: ID) => void; error?: string; keepId?: ID }) {
  const actions = useActions();
  const segments = useSegments() ?? [];
  const places = (useStores() ?? []).filter((s) => s.active || s.id === keepId || s.id === value);
  const groups = segments.filter((s) => s.mode === 'items').map((s) => ({ s, items: places.filter((p) => p.segmentId === s.id) })).filter((g) => g.items.length);

  return (
    <div className="flex items-end gap-2">
      <SelectField label="Lugar" value={value} onChange={(e) => onChange(e.target.value)} error={error} wrapperClassName="flex-1">
        <option value="" disabled>
          {places.length ? 'Escolha o lugar' : 'Cadastre um lugar'}
        </option>
        {groups.length > 1
          ? groups.map(({ s, items }) => (
              <optgroup key={s.id} label={s.name}>
                {items.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            ))
          : places.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
      </SelectField>
      <Button variant="secondary" className="h-12 w-12 px-0" aria-label="Cadastrar lugar" title="Cadastrar lugar" onClick={() => actions.openPlace({ mode: 'items', onSaved: onChange })}>
        <Plus className="h-5 w-5" />
      </Button>
    </div>
  );
}
