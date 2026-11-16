import { useEffect, useState } from 'react';
import { db } from '@/db/database';
import type { ID, Station } from '@/types';
import { Button, Sheet, TextField, TextareaField, Toggle, useFeedback } from '@/design-system';
import { saveStation, saveStore } from '@/repositories/places';
import { ColorSwatches, PLACE_COLORS } from './ColorSwatches';

const FLAGS = ['Petrobras', 'Ipiranga', 'Shell', 'Ale', 'Bandeira branca'];

export interface PlaceFormProps {
  open: boolean;
  onClose: () => void;
  kind: 'store' | 'station';
  placeId?: ID;
  onSaved?: (id: ID) => void;
}

export function PlaceForm({ open, onClose, kind, placeId, onSaved }: PlaceFormProps) {
  const { toast } = useFeedback();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [flag, setFlag] = useState('');
  const [notes, setNotes] = useState('');
  const [color, setColor] = useState(PLACE_COLORS[0]);
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const isStore = kind === 'store';

  useEffect(() => {
    if (!open) return;
    setError(undefined);
    const reset = async () => {
      const p = placeId ? await (isStore ? db.stores.get(placeId) : db.stations.get(placeId)) : undefined;
      const count = await (isStore ? db.stores.count() : db.stations.count());
      setName(p?.name ?? '');
      setAddress(p?.address ?? '');
      setNeighborhood(p?.neighborhood ?? '');
      setCity(p?.city ?? '');
      setFlag((p as Station | undefined)?.flag ?? '');
      setNotes(p?.notes ?? '');
      setColor(p?.color ?? PLACE_COLORS[count % PLACE_COLORS.length]);
      setActive(p?.active ?? true);
    };
    void reset();
  }, [open, placeId, isStore]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Informe o nome');
      return;
    }
    setSaving(true);
    try {
      const input = { name, address, neighborhood, city, notes, color, active, flag };
      const id = isStore ? await saveStore(input, placeId) : await saveStation(input, placeId);
      toast(placeId ? 'Alterações salvas' : isStore ? 'Mercado cadastrado' : 'Posto cadastrado');
      onSaved?.(id);
      onClose();
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  const title = placeId ? (isStore ? 'Editar mercado' : 'Editar posto') : isStore ? 'Novo mercado' : 'Novo posto';
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      dismissible={false}
      footer={
        <>
          <Button variant="secondary" block onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="place-form" block loading={saving}>
            {placeId ? 'Salvar alterações' : 'Cadastrar'}
          </Button>
        </>
      }
    >
      <form id="place-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <TextField
          label="Nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={error}
          placeholder={isStore ? 'Ex.: Mercado do bairro' : 'Ex.: Posto da avenida'}
          maxLength={100}
          data-autofocus
        />
        {!isStore && (
          <>
            <TextField label="Bandeira" optional value={flag} onChange={(e) => setFlag(e.target.value)} list="flag-options" maxLength={60} />
            <datalist id="flag-options">{FLAGS.map((f) => <option key={f} value={f} />)}</datalist>
          </>
        )}
        <TextField label="Endereço" optional value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Bairro" optional value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} maxLength={80} />
          <TextField label="Cidade" optional value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} />
        </div>
        <ColorSwatches value={color} onChange={setColor} />
        <Toggle
          label="Ativo"
          description={isStore ? 'Inativos não entram na comparação de listas.' : 'Inativos ficam fora do ranking de preços.'}
          checked={active}
          onChange={setActive}
        />
        <TextareaField label="Observações" optional value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
      </form>
    </Sheet>
  );
}
