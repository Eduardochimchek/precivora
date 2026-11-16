import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus } from 'lucide-react';
import { db } from '@/db/database';
import { FUEL_TYPES, type FuelPrice, type FuelType, type ID } from '@/types';
import { Button, ChangeBadge, SelectField, Sheet, TextField, TextareaField, Toggle, useFeedback } from '@/design-system';
import { useStations } from '@/hooks/useData';
import { saveFuelPrice } from '@/repositories/prices';
import { FUEL_LABEL, fuelUnit } from '@/services/fuel';
import { priceChange } from '@/services/comparison';
import { formatDateTime, fromDateTimeInput, toDateTimeInput } from '@/utils/date';
import { money3, parseDecimal, toInputDecimal } from '@/utils/format';
import { useActions } from './ActionsContext';

export interface FuelPriceFormProps {
  open: boolean;
  onClose: () => void;
  stationId?: ID;
  fuel?: FuelType;
  recordId?: ID;
}

export function FuelPriceForm({ open, onClose, stationId: initialStation, fuel: initialFuel, recordId }: FuelPriceFormProps) {
  const { toast } = useFeedback();
  const actions = useActions();
  const stations = (useStations() ?? []).filter((s) => s.active || s.id === initialStation);
  const [stationId, setStationId] = useState<ID | ''>('');
  const [fuel, setFuel] = useState<FuelType>('gasolina_comum');
  const [price, setPrice] = useState('');
  const [date, setDate] = useState(toDateTimeInput());
  const [promo, setPromo] = useState(false);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (recordId) {
      void db.fuelPrices.get(recordId).then((r) => {
        if (!r) return;
        setStationId(r.stationId);
        setFuel(r.fuel);
        setPrice(toInputDecimal(r.price, 3));
        setDate(toDateTimeInput(r.date));
        setPromo(r.promo);
        setNotes(r.notes ?? '');
      });
      return;
    }
    setStationId(initialStation ?? '');
    setFuel(initialFuel ?? 'gasolina_comum');
    setPrice('');
    setDate(toDateTimeInput());
    setPromo(false);
    setNotes('');
  }, [open, recordId, initialStation, initialFuel]);

  const last = useLiveQuery(async (): Promise<FuelPrice | undefined> => {
    if (!stationId) return undefined;
    const list = await db.fuelPrices
      .where('stationId')
      .equals(stationId)
      .filter((r) => r.fuel === fuel && r.id !== recordId)
      .sortBy('date');
    return list[list.length - 1];
  }, [stationId, fuel, recordId]);
  const value = parseDecimal(price);
  const change = useMemo(() => (last && value > 0 ? priceChange(last.price, value) : null), [last, value]);

  async function submit(again: boolean) {
    const errs: Record<string, string> = {};
    if (!stationId) errs.station = 'Escolha o posto';
    if (!(value > 0 && value < 100)) errs.price = 'Informe o preço por ' + (fuel === 'gnv' ? 'm³' : 'litro');
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      await saveFuelPrice({ stationId: stationId as ID, fuel, price: value, date: fromDateTimeInput(date), promo, notes }, recordId);
      toast(recordId ? 'Preço atualizado' : 'Preço registrado');
      if (again && !recordId) {
        setPrice('');
        setPromo(false);
        setNotes('');
        const next = FUEL_TYPES[(FUEL_TYPES.indexOf(fuel) + 1) % FUEL_TYPES.length];
        setFuel(next);
      } else onClose();
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={recordId ? 'Editar preço de combustível' : 'Preço de combustível'}
      dismissible={false}
      footer={
        recordId ? (
          <Button block onClick={() => submit(false)} loading={saving}>
            Salvar alterações
          </Button>
        ) : (
          <>
            <Button variant="secondary" block onClick={() => submit(true)} disabled={saving}>
              Salvar e outro
            </Button>
            <Button block onClick={() => submit(false)} loading={saving}>
              Salvar preço
            </Button>
          </>
        )
      }
    >
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit(false);
        }}
      >
        <div className="flex items-end gap-2">
          <SelectField label="Posto" value={stationId} onChange={(e) => setStationId(e.target.value)} error={errors.station} wrapperClassName="flex-1" data-autofocus={!initialStation || undefined}>
            <option value="" disabled>
              {stations.length ? 'Escolha o posto' : 'Cadastre um posto'}
            </option>
            {stations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.flag ? ` (${s.flag})` : ''}
              </option>
            ))}
          </SelectField>
          <Button
            variant="secondary"
            className="h-12 w-12 px-0"
            aria-label="Cadastrar posto"
            title="Cadastrar posto"
            onClick={() => actions.openPlace({ mode: 'fuel', onSaved: setStationId })}
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
        <SelectField label="Combustível" value={fuel} onChange={(e) => setFuel(e.target.value as FuelType)}>
          {FUEL_TYPES.map((f) => (
            <option key={f} value={f}>
              {FUEL_LABEL[f]}
            </option>
          ))}
        </SelectField>
        <TextField
          label={`Preço por ${fuelUnit(fuel)}`}
          prefix="R$"
          inputMode="decimal"
          placeholder="0,000"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          error={errors.price}
          className="price text-lg font-bold"
          autoFocus={!!initialStation && !recordId}
        />
        {last && (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-sunken p-4 text-sm" aria-live="polite">
            <div>
              <div className="text-muted">
                Último neste posto: <span className="price font-bold text-ink">{money3(last.price)}</span>
              </div>
              <div className="text-xs text-muted">em {formatDateTime(last.date)}</div>
            </div>
            {change && <ChangeBadge change={change} />}
          </div>
        )}
        <TextField label="Data e hora da consulta" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
        <Toggle label="Preço promocional" description="Ex.: desconto por aplicativo ou dia da semana." checked={promo} onChange={setPromo} />
        <TextareaField label="Observações" optional value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} rows={2} />
      </form>
    </Sheet>
  );
}
