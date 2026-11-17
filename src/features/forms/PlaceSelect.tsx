import type { ID } from '@/types';
import { useActions } from './ActionsContext';
import { PlacePicker } from './PlacePicker';

/** Escolha de lugar de produtos (mercado, farmácia...), com busca e atalho para cadastrar. */
export function PlaceSelect({ value, onChange, error, keepId }: { value: ID | ''; onChange: (id: ID) => void; error?: string; keepId?: ID }) {
  const actions = useActions();
  return <PlacePicker mode="items" value={value} onChange={onChange} error={error} keepId={keepId} onCreate={() => actions.openPlace({ mode: 'items', onSaved: onChange })} />;
}
