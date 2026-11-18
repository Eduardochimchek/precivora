import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { FUEL_TYPES, type FuelPrice, type FuelType, type ID } from '@/types';
import { Button, ChangeBadge, SelectField, Sheet, TextField, TextareaField, Toggle, useFeedback } from '@/design-system';
import { saveFuelPrice } from '@/repositories/prices';
import { FUEL_LABEL, fuelUnit } from '@/services/fuel';
import { priceChange } from '@/services/comparison';
import { formatDateTime, fromDateTimeInput, toDateTimeInput } from '@/utils/date';
import { decimalPlaces, money3, parseDecimal, toInputDecimal } from '@/utils/format';
import { PlacePicker } from './PlacePicker';
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
    else if (decimalPlaces(price) > 3) errs.price = 'Use no máximo 3 casas depois da vírgula';
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
        <PlacePicker
          mode="fuel"
          label="Posto"
          value={stationId}
          onChange={setStationId}
          error={errors.station}
          keepId={initialStation}
          autoFocus={!initialStation}
          onCreate={() => actions.openPlace({ mode: 'fuel', onSaved: setStationId })}
        />
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
