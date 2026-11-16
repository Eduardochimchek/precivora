import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Archive, ArchiveRestore, Check, Copy, Info, ListChecks, Minus, Pencil, Plus, Route, ShoppingCart, Trash2, Trophy } from 'lucide-react';
import { db } from '@/db/database';
import { PageHeader } from '@/components/PageHeader';
import { Button, Card, Chip, EmptyState, IconButton, ListSkeleton, PlaceMark, PriceTag, Section, Sheet, TextField, Toggle, cx, useFeedback } from '@/design-system';
import { useActions } from '@/features/forms/ActionsContext';
import { ProductPicker } from '@/features/forms/ProductPicker';
import { useSettings } from '@/app/SettingsContext';
import { useBrands, useMapById, usePrices, useProducts, useStores } from '@/hooks/useData';
import { addListItem, clearChecked, deleteList, duplicateList, removeListItem, renameList, setListArchived, updateListItem } from '@/repositories/lists';
import { optimizeList, type QuoteTable } from '@/services/listOptimizer';
import { byRecent } from '@/services/comparison';
import { packageLabel, packagePrice } from '@/services/units';
import { isStale } from '@/utils/date';
import { money, parseDecimal, toInputDecimal } from '@/utils/format';
import type { ID, Priority } from '@/types';

const PRIORITY: Record<Priority, { label: string; tone: 'bad' | 'neutral' | 'info' }> = {
  alta: { label: 'Alta', tone: 'bad' },
  media: { label: 'Média', tone: 'neutral' },
  baixa: { label: 'Baixa', tone: 'info' },
};
const PRIORITY_ORDER: Priority[] = ['alta', 'media', 'baixa'];

export default function ListDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const actions = useActions();
  const { toast, confirm } = useFeedback();
  const { settings, update } = useSettings();
  const list = useLiveQuery(() => db.lists.get(id).then((l) => l ?? null), [id]);
  const items = useLiveQuery(() => db.listItems.where('listId').equals(id).toArray(), [id]);
  const products = useProducts();
  const productMap = useMapById(products);
  const brands = useMapById(useBrands());
  const stores = useStores();
  const storeMap = useMapById(stores);
  const prices = usePrices();
  const [adding, setAdding] = useState<ID | undefined>();
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState('');

  const pending = useMemo(() => (items ?? []).filter((i) => !i.checked), [items]);

  const result = useMemo(() => {
    if (!prices || !stores) return null;
    const activeStores = stores.filter((s) => s.active).map((s) => s.id);
    const quotes: QuoteTable = new Map();
    const sorted = [...prices].sort(byRecent);
    const wanted = new Set(pending.map((i) => i.productId));
    for (const r of sorted) {
      if (!wanted.has(r.productId) || !activeStores.includes(r.storeId)) continue;
      const m = quotes.get(r.productId) ?? new Map();
      if (!m.has(r.storeId)) m.set(r.storeId, { price: packagePrice(r), date: r.date, stale: isStale(r.date, settings.staleDays) });
      quotes.set(r.productId, m);
    }
    return optimizeList(
      pending.map((i) => ({ itemId: i.id, productId: i.productId, quantity: i.quantity })),
      quotes,
      activeStores,
      { tripCost: settings.tripCost, preferSingleStore: settings.preferSingleStore, minSplitSavings: settings.minSplitSavings },
    );
  }, [prices, stores, pending, settings.staleDays, settings.tripCost, settings.preferSingleStore, settings.minSplitSavings]);

  if (list === undefined || !items || !products) return <div className="pt-9"><ListSkeleton /></div>;
  if (list === null)
    return (
      <div className="pt-9">
        <EmptyState icon={<ListChecks className="h-6 w-6" />} title="Lista não encontrada" action={<Button onClick={() => navigate('/listas')}>Ver listas</Button>} />
      </div>
    );

  const sortedItems = [...items].sort(
    (a, b) =>
      Number(a.checked) - Number(b.checked) ||
      PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority) ||
      (productMap.get(a.productId)?.name ?? '').localeCompare(productMap.get(b.productId)?.name ?? ''),
  );
  const checkedCount = items.length - pending.length;
  const rec = result?.recommendation;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back="/listas"
        title={list.name}
        subtitle={`${items.length} ${items.length === 1 ? 'item' : 'itens'} · ${checkedCount} comprado${checkedCount === 1 ? '' : 's'}`}
        actions={
          <IconButton
            label="Renomear lista"
            onClick={() => {
              setNewName(list.name);
              setRenaming(true);
            }}
          >
            <Pencil className="h-5 w-5" />
          </IconButton>
        }
      />

      <form
        className="flex items-end gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!adding) return;
          await addListItem(list.id, adding);
          setAdding(undefined);
        }}
      >
        <div className="flex-1">
          <ProductPicker
            label="Adicionar produto"
            products={products}
            brands={brands}
            value={adding}
            onChange={async (pid) => {
              await addListItem(list.id, pid);
              setAdding(undefined);
              toast(`${productMap.get(pid)?.name ?? 'Produto'} adicionado`);
            }}
            onCreate={(name) =>
              actions.openProduct({
                initialName: name,
                onSaved: (pid) => void addListItem(list.id, pid),
              })
            }
          />
        </div>
      </form>

      {items.length === 0 ? (
        <EmptyState icon={<ListChecks className="h-6 w-6" />} title="Lista vazia">
          Busque acima os produtos que você precisa comprar.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-lg bg-surface shadow-card">
          {sortedItems.map((it) => {
            const p = productMap.get(it.productId);
            const assigned = result?.split?.assignments.find((a) => a.itemId === it.id);
            return (
              <li key={it.id} className={cx('flex items-center gap-2 py-2 pl-2 pr-1', it.checked && 'opacity-60')}>
                <button
                  role="checkbox"
                  aria-checked={it.checked}
                  aria-label={`Marcar ${p?.name ?? 'item'} como comprado`}
                  onClick={() => updateListItem(it.id, { checked: !it.checked })}
                  className="flex h-11 w-11 shrink-0 items-center justify-center"
                >
                  <span className={cx('flex h-6 w-6 items-center justify-center rounded-md border-2 transition-colors', it.checked ? 'border-success bg-success text-white' : 'border-line')}>
                    {it.checked && <Check className="h-4 w-4" strokeWidth={3} aria-hidden />}
                  </span>
                </button>
                <div className="min-w-0 flex-1">
                  <Link to={`/produtos/${it.productId}`} className={cx('block truncate font-semibold', it.checked && 'line-through')}>
                    {p?.name ?? 'Produto removido'}
                  </Link>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    {p && packageLabel(p)}
                    <button
                      onClick={() => updateListItem(it.id, { priority: PRIORITY_ORDER[(PRIORITY_ORDER.indexOf(it.priority) + 1) % 3] })}
                      aria-label={`Prioridade ${PRIORITY[it.priority].label}. Tocar para mudar.`}
                    >
                      <Chip tone={PRIORITY[it.priority].tone}>{PRIORITY[it.priority].label}</Chip>
                    </button>
                    {assigned && !it.checked && (
                      <span className="basis-full">
                        {money(assigned.price)} em {storeMap.get(assigned.storeId)?.name}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center rounded-full border border-line">
                  <IconButton
                    label="Diminuir quantidade"
                    className="h-9 w-9"
                    onClick={() => (it.quantity > 1 ? updateListItem(it.id, { quantity: it.quantity - 1 }) : removeListItem(it.id))}
                  >
                    {it.quantity > 1 ? <Minus className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                  </IconButton>
                  <span className="price w-7 text-center font-bold" aria-label={`Quantidade ${it.quantity}`}>
                    {toInputDecimal(it.quantity, 2).replace(/,00$/, '')}
                  </span>
                  <IconButton label="Aumentar quantidade" className="h-9 w-9" onClick={() => updateListItem(it.id, { quantity: it.quantity + 1 })}>
                    <Plus className="h-4 w-4" />
                  </IconButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {pending.length > 0 && result && (
        <Section title="Onde comprar" id="onde-comprar">
          {rec?.kind === 'insufficient' ? (
            <Card className="flex items-start gap-3 p-4 text-sm">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
              <span>{rec.reason} Registre preços dos itens nos mercados para comparar.</span>
            </Card>
          ) : (
            <>
              {rec && (
                <section aria-label="Recomendação" className="rounded-xl bg-navy p-5 text-[#F1F5F9] dark:bg-raised">
                  <div className="flex items-center gap-2 text-sm text-[#94A3B8]">
                    {rec.kind === 'split' ? <Route className="h-4 w-4 text-lime" aria-hidden /> : <Trophy className="h-4 w-4 text-lime" aria-hidden />}
                    {rec.kind === 'split' ? 'Compra dividida' : 'Melhor mercado único'}
                  </div>
                  <div className="mt-2 font-display text-xl font-bold leading-snug">{rec.stores.map((s) => storeMap.get(s)?.name).join(' + ')}</div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <PriceTag value={money(rec.total)} tone="best" size="md" />
                    {rec.netSavings > 0 && rec.kind === 'split' && <span className="text-sm text-lime">economia líquida de {money(rec.netSavings)}</span>}
                  </div>
                  <p className="mt-3 text-sm text-[#CBD5E1]">{rec.reason}</p>
                  <p className="mt-1 text-xs text-[#94A3B8]">
                    Baseado no último preço registrado de cada item ({result.pricedItems} de {pending.length} com preço).
                  </p>
                </section>
              )}

              <Card className="divide-y divide-line">
                {result.perStore.map((s) => (
                  <div key={s.storeId} className="flex items-center gap-3 px-4 py-3">
                    <PlaceMark name={storeMap.get(s.storeId)?.name ?? '?'} color={storeMap.get(s.storeId)?.color ?? '#64748B'} size={34} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{storeMap.get(s.storeId)?.name}</div>
                      <div className="flex flex-wrap gap-1.5 text-xs text-muted">
                        {s.complete ? 'todos os itens com preço' : `${s.covered} de ${result.pricedItems} itens com preço`}
                        {s.staleCount > 0 && <Chip tone="warn">{s.staleCount} desatualizado{s.staleCount > 1 ? 's' : ''}</Chip>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={cx('price font-bold', !s.complete && 'text-muted')}>{money(s.total)}</div>
                      {!s.complete && <div className="text-[11px] text-muted">parcial</div>}
                    </div>
                  </div>
                ))}
                {result.split && result.split.stores.length > 1 && (
                  <div className="flex items-center gap-3 bg-sunken/60 px-4 py-3">
                    <Route className="h-5 w-5 text-accent" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">Compra dividida</div>
                      <div className="text-xs text-muted">
                        {money(result.split.goods)} em produtos + {money(result.split.travelCost)} de deslocamento
                      </div>
                    </div>
                    <div className="price font-bold">{money(result.split.total)}</div>
                  </div>
                )}
              </Card>

              {result.unpricedItems.length > 0 && (
                <p className="text-xs text-muted">
                  Sem preço registrado: {result.unpricedItems.map((i) => productMap.get(i.productId)?.name).join(', ')}.
                </p>
              )}

              <details className="rounded-lg border border-line p-4">
                <summary className="cursor-pointer text-sm font-semibold">Ajustar deslocamento e preferência</summary>
                <div className="mt-4 flex flex-col gap-3">
                  <TextField
                    label="Custo de cada mercado a mais"
                    prefix="R$"
                    inputMode="decimal"
                    defaultValue={toInputDecimal(settings.tripCost)}
                    onBlur={(e) => {
                      const v = parseDecimal(e.target.value);
                      if (v >= 0) void update({ tripCost: v });
                    }}
                    hint="Combustível, estacionamento, tempo. Entra no cálculo da compra dividida."
                  />
                  <Toggle
                    label="Prefiro comprar em um só mercado"
                    description={`Só sugere dividir se economizar pelo menos ${money(settings.minSplitSavings)}.`}
                    checked={settings.preferSingleStore}
                    onChange={(v) => update({ preferSingleStore: v })}
                  />
                  {settings.preferSingleStore && (
                    <TextField
                      label="Economia mínima para dividir"
                      prefix="R$"
                      inputMode="decimal"
                      defaultValue={toInputDecimal(settings.minSplitSavings)}
                      onBlur={(e) => {
                        const v = parseDecimal(e.target.value);
                        if (v >= 0) void update({ minSplitSavings: v });
                      }}
                    />
                  )}
                </div>
              </details>
            </>
          )}
        </Section>
      )}

      <div className="flex flex-wrap gap-2 border-t border-line pt-5">
        {checkedCount > 0 && (
          <Button
            size="sm"
            icon={<ShoppingCart className="h-4 w-4" />}
            onClick={() => navigate(`/compras/nova?lista=${list.id}${rec?.kind === 'single' ? `&mercado=${rec.stores[0]}` : ''}`)}
          >
            Registrar compra dos marcados
          </Button>
        )}
        {checkedCount > 0 && (
          <Button size="sm" variant="secondary" onClick={async () => toast(`${await clearChecked(list.id)} itens removidos`)}>
            Limpar comprados
          </Button>
        )}
        <Button size="sm" variant="secondary" icon={<Copy className="h-4 w-4" />} onClick={async () => navigate(`/listas/${await duplicateList(list.id)}`)}>
          Duplicar
        </Button>
        <Button
          size="sm"
          variant="secondary"
          icon={list.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
          onClick={async () => {
            await setListArchived(list.id, !list.archived);
            toast(list.archived ? 'Lista reativada' : 'Lista arquivada');
          }}
        >
          {list.archived ? 'Reativar' : 'Arquivar'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-danger"
          icon={<Trash2 className="h-4 w-4" />}
          onClick={async () => {
            if (await confirm({ title: 'Excluir lista?', message: `"${list.name}" e seus ${items.length} itens serão apagados.`, confirmLabel: 'Excluir', danger: true })) {
              await deleteList(list.id);
              toast('Lista excluída');
              navigate('/listas', { replace: true });
            }
          }}
        >
          Excluir
        </Button>
      </div>

      <Sheet
        open={renaming}
        onClose={() => setRenaming(false)}
        title="Renomear lista"
        footer={
          <Button type="submit" form="rename-list" block>
            Salvar
          </Button>
        }
      >
        <form
          id="rename-list"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await renameList(list.id, newName);
              setRenaming(false);
            } catch (err) {
              toast((err as Error).message, 'error');
            }
          }}
        >
          <TextField label="Nome" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={80} data-autofocus />
        </form>
      </Sheet>
    </div>
  );
}
