import { useEffect, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { db } from '@/db/database';
import type { ID, SegmentMode } from '@/types';
import { Button, PlaceMark, SegmentIcon, Sheet, TextField, TextareaField, Toggle, cx, useFeedback } from '@/design-system';
import { useSegments } from '@/hooks/useData';
import { savePlace } from '@/repositories/places';
import { compressImage } from '@/utils/image';
import { ColorSwatches, PLACE_COLORS } from './ColorSwatches';

const FLAGS = ['Petrobras', 'Ipiranga', 'Shell', 'Ale', 'Bandeira branca'];

export interface PlaceFormProps {
  open: boolean;
  onClose: () => void;
  placeId?: ID;
  /** Tipo sugerido para um lugar novo. */
  segmentId?: ID;
  /** Restringe os tipos oferecidos (ex.: só postos ao vir do formulário de combustível). */
  mode?: SegmentMode;
  onSaved?: (id: ID) => void;
}

export function PlaceForm({ open, onClose, placeId, segmentId: initialSegment, mode, onSaved }: PlaceFormProps) {
  const { toast } = useFeedback();
  const segments = (useSegments() ?? []).filter((s) => !mode || s.mode === mode);
  const [segmentId, setSegmentId] = useState<ID>('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [flag, setFlag] = useState('');
  const [notes, setNotes] = useState('');
  const [color, setColor] = useState(PLACE_COLORS[0]);
  const [active, setActive] = useState(true);
  const [logo, setLogo] = useState<string | undefined>();
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(undefined);
    void (async () => {
      const p = placeId ? await db.stores.get(placeId) : undefined;
      const count = await db.stores.count();
      const segs = (await db.segments.orderBy('order').toArray()).filter((s) => !mode || s.mode === mode);
      setSegmentId(p?.segmentId ?? initialSegment ?? segs[0]?.id ?? '');
      setName(p?.name ?? '');
      setAddress(p?.address ?? '');
      setNeighborhood(p?.neighborhood ?? '');
      setCity(p?.city ?? '');
      setFlag(p?.flag ?? '');
      setNotes(p?.notes ?? '');
      setColor(p?.color ?? PLACE_COLORS[count % PLACE_COLORS.length]);
      setActive(p?.active ?? true);
      setLogo(p?.logo);
    })();
  }, [open, placeId, initialSegment, mode]);

  const segment = segments.find((s) => s.id === segmentId);
  const isFuel = segment?.mode === 'fuel';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Informe o nome');
      return;
    }
    setSaving(true);
    try {
      const id = await savePlace({ segmentId, name, address, neighborhood, city, notes, color, active, flag, logo: logo ?? null }, placeId);
      toast(placeId ? 'Alterações salvas' : 'Lugar cadastrado');
      onSaved?.(id);
      onClose();
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function pickLogo(file?: File) {
    if (!file) return;
    try {
      setLogo(await compressImage(file, 256));
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={placeId ? 'Editar lugar' : 'Novo lugar'}
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
        {segments.length > 1 && (
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Tipo</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo de lugar">
              {segments.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={segmentId === s.id}
                  onClick={() => setSegmentId(s.id)}
                  className={cx(
                    'flex h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition-colors',
                    segmentId === s.id ? 'border-transparent bg-primary text-on-primary' : 'border-line text-muted hover:text-ink',
                  )}
                >
                  <SegmentIcon icon={s.icon} />
                  {s.name}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        <TextField
          label="Nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={error}
          placeholder={isFuel ? 'Ex.: Posto da avenida' : segment ? `Ex.: ${segment.name} do bairro` : 'Ex.: Mercado do bairro'}
          maxLength={100}
          data-autofocus
        />
        {isFuel && (
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
        <div>
          <span className="mb-1.5 block text-sm font-semibold">
            Logo ou foto <span className="font-normal text-muted">(opcional)</span>
          </span>
          <div className="flex items-center gap-3">
            {logo ? (
              <PlaceMark name={name || '?'} color={color} logo={logo} size={56} />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-[30%] bg-sunken text-muted">
                <ImagePlus className="h-5 w-5" aria-hidden />
              </div>
            )}
            <label className="inline-flex h-10 cursor-pointer items-center rounded-md border border-line px-3 text-sm font-semibold hover:bg-sunken focus-within:ring-2 focus-within:ring-accent">
              {logo ? 'Trocar' : 'Escolher imagem'}
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => pickLogo(e.target.files?.[0])} />
            </label>
            {logo && (
              <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => setLogo(undefined)}>
                Remover
              </Button>
            )}
          </div>
        </div>
        <ColorSwatches value={color} onChange={setColor} />
        <Toggle
          label="Ativo"
          description={isFuel ? 'Inativos ficam fora do ranking de preços.' : 'Inativos não entram na comparação de listas.'}
          checked={active}
          onChange={setActive}
        />
        <TextareaField label="Observações" optional value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
      </form>
    </Sheet>
  );
}
