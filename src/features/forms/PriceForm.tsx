import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus } from 'lucide-react';
import { db } from '@/db/database';
import type { ID, PriceRecord } from '@/types';
import { Button, ChangeBadge, SelectField, Sheet, TextField, TextareaField, Toggle, useFeedback } from '@/design-system';
import { useBrands, useMapById, useProducts, useStores } from '@/hooks/useData';
import { savePrice } from '@/repositories/prices';
import { compareWithLast } from '@/services/comparison';
import { formatUnitPrice, packageLabel, unitPrice } from '@/services/units';
import { formatDate, fromDateInput, toDateInput } from '@/utils/date';
import { money, parseDecimal, toInputDecimal } from '@/utils/format';
import { ProductPicker } from './ProductPicker';
import { useActions } from './ActionsContext';

export interface PriceFormProps {
  open: boolean;
  onClose: () => void;
  productId?: ID;
  storeId?: ID;
  priceId?: ID;
}

export function PriceForm({ open, onClose, productId: initialProduct, storeId: initialStore, priceId }: PriceFormProps) {
  const { toast } = useFeedback();
  const actions = useActions();
  const products = useProducts() ?? [];
  const brands = useMapById(useBrands());
  const stores = (useStores() ?? []).filter((s) => s.active || s.id === initialStore);
  const [productId, setProductId] = useState<ID | undefined>();
  const [storeId, setStoreId] = useState<ID | ''>('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [date, setDate] = useState(toDateInput());
  const [promo, setPromo] = useState(false);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (priceId) {
      void db.prices.get(priceId).then((r) => {
        if (!r) return;
        setProductId(r.productId);
        setStoreId(r.storeId);
        setPrice(toInputDecimal(r.price));
        setQuantity(String(r.quantity));
        setDate(toDateInput(r.date));
        setPromo(r.promo);
        setNotes(r.notes ?? '');
      });
      return;
    }
    setProductId(initialProduct);
    setPrice('');
    setQuantity('1');
    setPromo(false);
    setNotes('');
    setDate(toDateInput());
    if (initialStore) setStoreId(initialStore);
    else
      void db.prices
        .orderBy('createdAt')
        .last()
        .then((r) => setStoreId((s) => s || r?.storeId || ''));
  }, [open, priceId, initialProduct, initialStore]);

  const product = products.find((p) => p.id === productId);
  const history = useLiveQuery(
    async (): Promise<PriceRecord[]> => (productId ? db.prices.where('productId').equals(productId).toArray() : []),
    [productId],
  );
  const value = parseDecimal(price);
  const qty = parseDecimal(quantity) || 1;
  const pkg = value > 0 ? value / qty : NaN;

  const comparison = useMemo(() => {
    if (!history || !storeId || !(pkg > 0)) return null;
    return compareWithLast(history.filter((h) => h.id !== priceId), storeId, pkg);
  }, [history, storeId, pkg, priceId]);

  async function submit(again: boolean) {
    const errs: Record<string, string> = {};
    if (!productId) errs.product = 'Escolha o produto';
    if (!storeId) errs.store = 'Escolha o mercado';
    if (!(value > 0)) errs.price = 'Informe o preço';
    if (!(qty > 0)) errs.quantity = 'Quantidade inválida';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      await savePrice({ productId: productId!, storeId: storeId as ID, price: value, quantity: qty, date: fromDateInput(date), promo, notes }, priceId);
      toast(priceId ? 'Preço atualizado' : 'Preço registrado');
      if (again && !priceId) {
        setProductId(undefined);
        setPrice('');
        setQuantity('1');
        setPromo(false);
        setNotes('');
        document.querySelector<HTMLInputElement>('#price-form [role="combobox"]')?.focus();
      } else onClose();
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  const storeName = (id: ID) => stores.find((s) => s.id === id)?.name ?? 'outro mercado';

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={priceId ? 'Editar preço' : 'Registrar preço'}
      dismissible={false}
      footer={
        priceId ? (
          <Button block onClick={() => submit(false)} loading={saving}>
            Salvar alterações
          </Button>
        ) : (
          <>
            <Button variant="secondary" block onClick={() => submit(true)} disabled={saving}>
              Salvar e próximo
            </Button>
            <Button block onClick={() => submit(false)} loading={saving}>
              Salvar preço
            </Button>
          </>
        )
      }
    >
      <form
        id="price-form"
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit(false);
        }}
      >
        <ProductPicker
          products={products}
          brands={brands}
          value={productId}
          onChange={setProductId}
          error={errors.product}
          autoFocus={!initialProduct && !priceId}
          onCreate={(name) => actions.openProduct({ initialName: name, onSaved: setProductId })}
        />
        <div className="flex items-end gap-2">
          <SelectField
            label="Mercado"
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            error={errors.store}
            wrapperClassName="flex-1"
          >
            <option value="" disabled>
              {stores.length ? 'Escolha o mercado' : 'Cadastre um mercado'}
            </option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </SelectField>
          <Button
            variant="secondary"
            className="mb-0 h-12 w-12 px-0"
            aria-label="Cadastrar mercado"
            title="Cadastrar mercado"
            onClick={() => actions.openPlace({ kind: 'store', onSaved: setStoreId })}
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
        <div className="grid grid-cols-[1fr_96px] gap-3">
          <TextField
            label="Preço"
            prefix="R$"
            inputMode="decimal"
            placeholder="0,00"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            error={errors.price}
            className="price text-lg font-bold"
            autoFocus={!!initialProduct && !priceId}
          />
          <TextField label="Embalagens" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} error={errors.quantity} />
        </div>
        {qty > 1 && pkg > 0 && <p className="-mt-2 text-xs text-muted">Cada embalagem sai por {money(pkg)} (ex.: “leve {qty} por {money(value)}”).</p>}

        {product && pkg > 0 && (
          <div className="rounded-lg bg-sunken p-4" aria-live="polite">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted">{packageLabel(product)}</span>
              <span className="price text-sm font-bold">{formatUnitPrice(unitPrice(pkg, product), product.unit)}</span>
            </div>
            {comparison ? (
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
                <div className="text-sm">
                  <div className="text-muted">
                    Último preço{comparison.sameStore ? '' : ` (em ${storeName(comparison.reference.storeId)})`}:{' '}
                    <span className="price font-bold text-ink">{money(comparison.change.previous)}</span>
                  </div>
                  <div className="text-xs text-muted">registrado em {formatDate(comparison.reference.date)}</div>
                </div>
                <ChangeBadge change={comparison.change} />
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted">Primeiro preço deste produto{storeId ? ' neste mercado' : ''}.</p>
            )}
          </div>
        )}

        <TextField label="Data" type="date" value={date} max={toDateInput()} onChange={(e) => setDate(e.target.value)} />
        <Toggle label="Preço promocional" description="Ajuda a separar ofertas do preço normal." checked={promo} onChange={setPromo} />
        <TextareaField label="Observações" optional value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} rows={2} />
      </form>
    </Sheet>
  );
}
