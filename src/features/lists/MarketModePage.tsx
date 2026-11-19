import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, ListChecks, Pencil, ScanBarcode, ShoppingCart, Undo2 } from 'lucide-react';
import { db } from '@/db/database';
import { PageHeader } from '@/components/PageHeader';
import { Button, Card, EmptyState, IconButton, ListSkeleton, Section, Sheet, TextField, cx, useFeedback } from '@/design-system';
import { useActions } from '@/features/forms/ActionsContext';
import { PlaceSelect } from '@/features/forms/PlaceSelect';
import { useSettings } from '@/app/SettingsContext';
import { isNative } from '@/app/native';
import { loadCart, saveCart, type Cart } from '@/app/cart';
import { useMapById, usePrices, useProducts, usePurchases } from '@/hooks/useData';
import { addListItem, updateListItem } from '@/repositories/lists';
import { isValidGtin } from '@/services/productLookup';
import { byRecent } from '@/services/comparison';
import { packageLabel, packagePrice } from '@/services/units';
import { startOfMonth } from '@/utils/date';
import { decimalPlaces, money, parseDecimal, toInputDecimal } from '@/utils/format';
import type { ID, ListItem } from '@/types';

/** Modo mercado: no lugar, lê o código (ou toca no item), anota o preço e vê o total do carrinho contra o orçamento. */
export default function MarketModePage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const actions = useActions();
  const { toast } = useFeedback();
  const { settings } = useSettings();
  const list = useLiveQuery(() => db.lists.get(id).then((l) => l ?? null), [id]);
  const items = useLiveQuery(() => db.listItems.where('listId').equals(id).toArray(), [id]);
  const products = useProducts();
  const productMap = useMapById(products);
  const prices = usePrices();
  const purchases = usePurchases();
  const [cart, setCart] = useState<Cart>(() => {
    const c = loadCart(id);
    return c.storeId ? c : { ...c, storeId: params.get('lugar') ?? '' };
  });
  const [editing, setEditing] = useState<ListItem | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => saveCart(id, cart), [id, cart]);

  const lastPriceAt = useMemo(() => {
    const sorted = [...(prices ?? [])].sort(byRecent);
    return (productId: ID, storeId: ID | '') => {
      const r = sorted.find((x) => x.productId === productId && x.storeId === storeId);
      return r ? packagePrice(r) : undefined;
    };
  }, [prices]);

  const spentThisMonth = useMemo(() => {
    const start = startOfMonth(new Date()).getTime();
    return (purchases ?? []).filter((p) => Date.parse(p.date) >= start).reduce((s, p) => s + p.total, 0);
  }, [purchases]);

  if (list === undefined || !items || !products) return <div className="pt-9"><ListSkeleton /></div>;
  if (list === null)
    return (
      <div className="pt-9">
        <EmptyState icon={<ListChecks className="h-6 w-6" />} title="Lista não encontrada" action={<Button onClick={() => navigate('/listas')}>Ver listas</Button>} />
      </div>
    );

  const name = (it: ListItem) => productMap.get(it.productId)?.name ?? 'Produto removido';
  const pending = items.filter((i) => !i.checked).sort((a, b) => name(a).localeCompare(name(b)));
  const inCart = items.filter((i) => i.checked).sort((a, b) => name(a).localeCompare(name(b)));
  const cartTotal = inCart.reduce((s, i) => s + (cart.prices[i.id] ?? 0) * i.quantity, 0);
  const unpricedInCart = inCart.filter((i) => cart.prices[i.id] == null).length;
  const budget = settings.monthlyBudget;
  const left = budget - spentThisMonth - cartTotal;

  function openItem(it: ListItem) {
    if (!cart.storeId) {
      toast('Escolha primeiro em qual lugar você está.', 'error');
      return;
    }
    setEditing(it);
  }

  async function openProductId(pid: ID) {
    const existing = items!.find((i) => i.productId === pid);
    if (existing?.checked) {
      toast(`${productMap.get(pid)?.name ?? 'Produto'} já está no carrinho`);
      setEditing(existing);
      return;
    }
    const itemId = existing?.id ?? (await addListItem(list!.id, pid));
    const it = await db.listItems.get(itemId);
    if (it) setEditing(it);
  }

  async function scan() {
    if (!cart.storeId) {
      toast('Escolha primeiro em qual lugar você está.', 'error');
      return;
    }
    const { scanProductBarcode, ScanCancelled } = await import('@/app/nfceNative');
    setScanning(true);
    try {
      const code = (await scanProductBarcode()).replace(/\D/g, '');
      if (!isValidGtin(code)) {
        toast('Não consegui ler esse código direito. Tente de novo, com o código reto e bem iluminado.', 'error');
        return;
      }
      const found = await db.products.where('barcode').equals(code).first();
      if (found) await openProductId(found.id);
      else actions.openProduct({ initialBarcode: code, onSaved: (pid) => void openProductId(pid) });
    } catch (err) {
      if (!(err instanceof ScanCancelled)) toast((err as Error).message || 'Não foi possível ler o código', 'error');
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader back={`/listas/${list.id}`} title="Modo mercado" subtitle={list.name} />

      <PlaceSelect value={cart.storeId} onChange={(storeId) => setCart((c) => ({ ...c, storeId }))} />

      <section aria-label="Carrinho" className="sticky top-[max(0.5rem,env(safe-area-inset-top))] z-20 rounded-xl bg-navy p-4 text-[#F1F5F9] shadow-float dark:bg-raised">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-xs text-[#94A3B8]">No carrinho</div>
            <div className="price text-3xl font-bold text-lime">{money(cartTotal)}</div>
          </div>
          <div className="text-right text-sm text-[#CBD5E1]">
            {inCart.length} de {items.length} {items.length === 1 ? 'item' : 'itens'}
            {unpricedInCart > 0 && <div className="text-xs text-[#94A3B8]">{unpricedInCart} sem preço</div>}
          </div>
        </div>
        {budget > 0 && (
          <p className={cx('mt-2 border-t border-white/10 pt-2 text-sm', left < 0 ? 'text-[#FCA5A5]' : 'text-[#CBD5E1]')}>
            {left >= 0 ? `Restam ${money(left)} do orçamento do mês` : `Passa ${money(-left)} do orçamento do mês`}
          </p>
        )}
      </section>

      {isNative && (
        <Button size="lg" block icon={<ScanBarcode className="h-5 w-5" />} loading={scanning} onClick={() => void scan()}>
          Ler código de barras
        </Button>
      )}

      <Section title={`Falta pegar (${pending.length})`} id="falta">
        {pending.length ? (
          <Card className="divide-y divide-line overflow-hidden">
            {pending.map((it) => {
              const p = productMap.get(it.productId);
              const last = lastPriceAt(it.productId, cart.storeId);
              return (
                <button key={it.id} type="button" onClick={() => openItem(it)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-sunken">
                  <span className="flex h-6 w-6 shrink-0 rounded-md border-2 border-line" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{name(it)}</span>
                    <span className="block text-xs text-muted">
                      {[it.quantity !== 1 ? `${toInputDecimal(it.quantity, 2).replace(/,00$/, '')}x` : '', p && packageLabel(p)].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {last != null && <span className="shrink-0 text-right text-xs text-muted">último aqui<span className="price block text-sm font-bold text-ink">{money(last)}</span></span>}
                </button>
              );
            })}
          </Card>
        ) : (
          <p className="text-sm text-muted">Tudo pego. É só finalizar.</p>
        )}
      </Section>

      {inCart.length > 0 && (
        <Section title={`No carrinho (${inCart.length})`} id="carrinho">
          <Card className="divide-y divide-line overflow-hidden">
            {inCart.map((it) => {
              const price = cart.prices[it.id];
              return (
                <div key={it.id} className="flex items-center gap-2 py-2 pl-4 pr-1">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-success text-white" aria-hidden>
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </span>
                  <span className="min-w-0 flex-1 pl-1">
                    <span className="block truncate font-semibold">{name(it)}</span>
                    <span className="block text-xs text-muted">
                      {price != null ? `${toInputDecimal(it.quantity, 2).replace(/,00$/, '')} × ${money(price)}` : 'sem preço'}
                    </span>
                  </span>
                  <span className="price shrink-0 font-bold">{price != null ? money(price * it.quantity) : '—'}</span>
                  <IconButton label={`Editar ${name(it)}`} onClick={() => openItem(it)}>
                    <Pencil className="h-4 w-4" />
                  </IconButton>
                  <IconButton
                    label={`Tirar ${name(it)} do carrinho`}
                    onClick={() => {
                      void updateListItem(it.id, { checked: false });
                      setCart((c) => {
                        const { [it.id]: _, ...rest } = c.prices;
                        return { ...c, prices: rest };
                      });
                    }}
                  >
                    <Undo2 className="h-4 w-4" />
                  </IconButton>
                </div>
              );
            })}
          </Card>
        </Section>
      )}

      <div className="flex flex-col gap-2 border-t border-line pt-5">
        <Button
          size="lg"
          block
          icon={<ShoppingCart className="h-5 w-5" />}
          disabled={!cart.storeId || !inCart.length}
          onClick={() => navigate(`/compras/nova?lista=${list.id}&lugar=${cart.storeId}&carrinho=1`)}
        >
          Finalizar e registrar compra
        </Button>
        <p className="text-center text-xs text-muted">
          Os preços entram no histórico quando você registra a compra. O carrinho fica guardado até lá.{' '}
          <Link to={`/listas/${list.id}`} className="font-semibold text-accent">
            Ver lista
          </Link>
        </p>
      </div>

      <ItemPriceSheet
        item={editing}
        name={editing ? name(editing) : ''}
        pkg={editing ? packageLabel(productMap.get(editing.productId) ?? { unit: 'un', packageSize: 1 }) : ''}
        initialPrice={editing ? (cart.prices[editing.id] ?? lastPriceAt(editing.productId, cart.storeId)) : undefined}
        onClose={() => setEditing(null)}
        onSave={async (price, quantity) => {
          const it = editing!;
          await updateListItem(it.id, { checked: true, quantity });
          setCart((c) => ({ ...c, prices: { ...c.prices, [it.id]: price } }));
          setEditing(null);
          toast(`${name(it)} no carrinho`);
        }}
      />
    </div>
  );
}

function ItemPriceSheet({
  item,
  name,
  pkg,
  initialPrice,
  onClose,
  onSave,
}: {
  item: ListItem | null;
  name: string;
  pkg: string;
  initialPrice?: number;
  onClose: () => void;
  onSave: (price: number, quantity: number) => Promise<void>;
}) {
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('1');
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (!item) return;
    setPrice(initialPrice != null ? toInputDecimal(initialPrice) : '');
    setQty(toInputDecimal(item.quantity, 2).replace(/,00$/, ''));
    setError(undefined);
  }, [item, initialPrice]);

  const value = parseDecimal(price);
  const q = parseDecimal(qty);
  return (
    <Sheet
      open={!!item}
      onClose={onClose}
      title={name}
      description={pkg}
      footer={
        <Button type="submit" form="market-item" block icon={<ShoppingCart className="h-4 w-4" />}>
          Pôr no carrinho{value > 0 && q > 0 ? ` · ${money(value * q)}` : ''}
        </Button>
      }
    >
      <form
        id="market-item"
        className="grid grid-cols-[1fr_96px] items-end gap-3"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!(value > 0)) return setError('Informe o preço');
          if (decimalPlaces(price) > 2) return setError('Use no máximo 2 casas depois da vírgula');
          if (!(q > 0)) return setError('Quantidade inválida');
          void onSave(value, q);
        }}
      >
        <TextField
          label="Preço da embalagem"
          prefix="R$"
          inputMode="decimal"
          placeholder="0,00"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          error={error}
          className="price text-lg font-bold"
          data-autofocus
        />
        <TextField label="Quantidade" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
      </form>
    </Sheet>
  );
}
