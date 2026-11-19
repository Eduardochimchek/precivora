import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useGoBack } from '@/app/useGoBack';
import { Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { db } from '@/db/database';
import { PageHeader } from '@/components/PageHeader';
import { Button, Card, EmptyState, IconButton, ListSkeleton, TextField, TextareaField, useFeedback } from '@/design-system';
import { ProductPicker } from '@/features/forms/ProductPicker';
import { useActions } from '@/features/forms/ActionsContext';
import { PlaceSelect } from '@/features/forms/PlaceSelect';
import { useBrands, useMapById, usePrices, useProducts, useStores } from '@/hooks/useData';
import { deletePurchase, purchaseTotal, savePurchase } from '@/repositories/purchases';
import { byRecent } from '@/services/comparison';
import { packageLabel, packagePrice } from '@/services/units';
import { fromDateInput, toDateInput } from '@/utils/date';
import { money, parseDecimal, toInputDecimal } from '@/utils/format';
import { newId } from '@/utils/id';
import type { ID } from '@/types';

interface Row {
  key: string;
  productId: ID;
  quantity: string;
  unitPrice: string;
}

export default function PurchaseFormPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const goBack = useGoBack();
  const actions = useActions();
  const { toast, confirm } = useFeedback();
  const products = useProducts();
  const productMap = useMapById(products);
  const brands = useMapById(useBrands());
  const stores = useStores();
  const prices = usePrices();
  const [storeId, setStoreId] = useState<ID | ''>((params.get('lugar') ?? params.get('mercado')) ?? '');
  const [date, setDate] = useState(toDateInput());
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [picker, setPicker] = useState<ID | undefined>();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(!id && !params.get('lista'));
  const [missing, setMissing] = useState(false);

  const lastPrice = useMemo(() => {
    return (productId: ID, store: ID | '') => {
      if (!prices) return undefined;
      const recs = prices.filter((r) => r.productId === productId).sort(byRecent);
      const r = recs.find((x) => x.storeId === store) ?? recs[0];
      return r ? packagePrice(r) : undefined;
    };
  }, [prices]);

  useEffect(() => {
    if (id) {
      void (async () => {
        const p = await db.purchases.get(id);
        if (!p) {
          setMissing(true);
          setReady(true);
          return;
        }
        const its = await db.purchaseItems.where('purchaseId').equals(id).toArray();
        setStoreId(p.storeId);
        setDate(toDateInput(p.date));
        setNotes(p.notes ?? '');
        setRows(its.map((i) => ({ key: i.id, productId: i.productId, quantity: String(i.quantity).replace('.', ','), unitPrice: toInputDecimal(i.unitPrice) })));
        setReady(true);
      })();
      return;
    }
    const listId = params.get('lista');
    if (listId && prices) {
      void db.listItems
        .where('listId')
        .equals(listId)
        .filter((i) => i.checked)
        .toArray()
        .then((its) => {
          const store = (params.get('lugar') ?? params.get('mercado')) ?? '';
          setRows(
            its.map((i) => {
              const lp = lastPrice(i.productId, store);
              return { key: newId(), productId: i.productId, quantity: String(i.quantity).replace('.', ','), unitPrice: lp ? toInputDecimal(lp) : '' };
            }),
          );
          setReady(true);
        });
    }
  }, [id, params, prices, lastPrice]);

  const parsed = rows.map((r) => ({ ...r, q: parseDecimal(r.quantity), u: parseDecimal(r.unitPrice) }));
  const total = purchaseTotal(parsed.filter((r) => r.q > 0 && r.u >= 0).map((r) => ({ quantity: r.q, unitPrice: r.u })));

  function addProduct(pid: ID) {
    const lp = lastPrice(pid, storeId);
    setRows((rs) => [...rs, { key: newId(), productId: pid, quantity: '1', unitPrice: lp ? toInputDecimal(lp) : '' }]);
    setPicker(undefined);
  }

  async function submit() {
    const errs: Record<string, string> = {};
    if (!storeId) errs.store = 'Escolha o lugar';
    if (!rows.length) errs.items = 'Adicione ao menos um produto';
    parsed.forEach((r) => {
      if (!(r.q > 0)) errs[`q-${r.key}`] = 'Qtd.';
      if (!(r.u > 0)) errs[`u-${r.key}`] = 'Preço';
    });
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast('Confira os campos destacados', 'error');
      return;
    }
    setSaving(true);
    try {
      const pid = await savePurchase(
        { storeId: storeId as ID, date: fromDateInput(date), notes, items: parsed.map((r) => ({ productId: r.productId, quantity: r.q, unitPrice: r.u })) },
        id,
      );
      toast(id ? 'Compra atualizada' : 'Compra registrada');
      navigate('/historico', { replace: true, state: { highlight: pid } });
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  if (!ready || !products || !stores) return <div className="pt-9"><ListSkeleton /></div>;
  if (missing)
    return (
      <div className="pt-9">
        <EmptyState icon={<ShoppingCart className="h-6 w-6" />} title="Compra não encontrada" action={<Button onClick={() => navigate('/historico')}>Ver histórico</Button>} />
      </div>
    );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader back title={id ? 'Editar compra' : 'Nova compra'} subtitle="Os preços pagos entram no histórico como preço confirmado em compra." />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_200px]">
        <PlaceSelect value={storeId} onChange={setStoreId} error={errors.store} />
        <TextField label="Data" type="date" value={date} max={toDateInput()} onChange={(e) => setDate(e.target.value)} />
      </div>
      <ProductPicker
        label="Adicionar produto"
        products={products}
        brands={brands}
        value={picker}
        onChange={addProduct}
        error={errors.items}
        onCreate={(name) => actions.openProduct({ initialName: name, onSaved: addProduct })}
      />

      {rows.length > 0 && (
        <Card as="section" className="divide-y divide-line" aria-label="Itens da compra">
          {rows.map((r, i) => {
            const p = productMap.get(r.productId);
            const sub = parsed[i].q * parsed[i].u;
            return (
              <div key={r.key} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-end">
                <div className="flex min-w-0 flex-1 items-start justify-between gap-3 sm:pb-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{p?.name ?? 'Produto removido'}</div>
                    <div className="text-xs text-muted">{p ? packageLabel(p) : ''}</div>
                  </div>
                  <div className="price shrink-0 text-sm font-bold sm:hidden">{Number.isFinite(sub) ? money(sub) : '—'}</div>
                </div>
                <div className="flex items-end gap-2">
                  <TextField
                    label="Qtd."
                    inputMode="decimal"
                    value={r.quantity}
                    error={errors[`q-${r.key}`]}
                    onChange={(e) => setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, quantity: e.target.value } : x)))}
                    wrapperClassName="w-16 shrink-0 sm:w-20"
                  />
                  <TextField
                    label="Preço unit."
                    prefix="R$"
                    inputMode="decimal"
                    value={r.unitPrice}
                    error={errors[`u-${r.key}`]}
                    onChange={(e) => setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, unitPrice: e.target.value } : x)))}
                    wrapperClassName="min-w-0 flex-1 sm:w-32 sm:flex-none"
                  />
                  <div className="price mb-3 hidden w-20 text-right text-sm font-bold sm:block">{Number.isFinite(sub) ? money(sub) : '—'}</div>
                  <IconButton label={`Remover ${p?.name ?? 'item'}`} className="mb-0.5" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      <div className="flex items-baseline justify-between rounded-lg bg-navy px-5 py-4 text-[#F1F5F9] dark:bg-raised">
        <span className="text-sm text-[#94A3B8]">Total ({rows.length} {rows.length === 1 ? 'item' : 'itens'})</span>
        <span className="price text-3xl font-bold text-lime">{money(total)}</span>
      </div>

      <TextareaField label="Observações" optional value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} rows={2} />

      <div className="flex flex-wrap gap-2">
        <Button size="lg" className="flex-1" loading={saving} onClick={submit} icon={<Plus className="h-4 w-4" />}>
          {id ? 'Salvar alterações' : 'Registrar compra'}
        </Button>
        {id && (
          <Button
            size="lg"
            variant="ghost"
            className="text-danger"
            onClick={async () => {
              if (await confirm({ title: 'Excluir compra?', message: 'Os preços confirmados por esta compra também saem do histórico.', confirmLabel: 'Excluir', danger: true })) {
                await deletePurchase(id);
                toast('Compra excluída');
                goBack('/historico');
              }
            }}
          >
            Excluir
          </Button>
        )}
      </div>
    </div>
  );
}
