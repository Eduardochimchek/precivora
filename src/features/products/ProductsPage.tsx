import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, Plus, Search } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button, Chip, EmptyState, ListSkeleton, Segmented } from '@/design-system';
import { useActions } from '@/features/forms/ActionsContext';
import { useBrands, useCategories, useMapById, usePrices, useProducts } from '@/hooks/useData';
import { packageLabel } from '@/services/units';
import { matches } from '@/utils/text';

export default function ProductsPage() {
  const actions = useActions();
  const products = useProducts();
  const brands = useMapById(useBrands());
  const categories = useMapById(useCategories());
  const prices = usePrices();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'ativos' | 'arquivados'>('ativos');

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of prices ?? []) m.set(r.productId, (m.get(r.productId) ?? 0) + 1);
    return m;
  }, [prices]);

  const list = (products ?? []).filter((p) => (tab === 'ativos' ? !p.archived : p.archived)).filter((p) => matches(`${p.name} ${brands.get(p.brandId ?? '')?.name ?? ''}`, q));
  const grouped = useMemo(() => {
    const g = new Map<string, typeof list>();
    for (const p of list) {
      const k = p.categoryId ? (categories.get(p.categoryId)?.name ?? 'Sem categoria') : 'Sem categoria';
      g.set(k, [...(g.get(k) ?? []), p]);
    }
    return [...g.entries()].sort(([a], [b]) => (a === 'Sem categoria' ? 1 : b === 'Sem categoria' ? -1 : a.localeCompare(b)));
  }, [list, categories]);

  return (
    <div>
      <PageHeader
        back="/mais"
        title="Produtos"
        subtitle={products ? `${products.filter((p) => !p.archived).length} ativos` : undefined}
        actions={
          <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => actions.openProduct()}>
            Novo
          </Button>
        }
      />
      <div className="mb-4 flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            aria-label="Buscar produto"
            placeholder="Buscar"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-11 w-full rounded-md border border-line bg-surface pl-10 pr-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
          />
        </div>
        <Segmented label="Situação" value={tab} onChange={setTab} options={[{ value: 'ativos', label: 'Ativos' }, { value: 'arquivados', label: 'Arquivados' }]} />
      </div>
      {!products ? (
        <ListSkeleton />
      ) : !list.length ? (
        <EmptyState
          icon={<Package className="h-6 w-6" />}
          title={tab === 'arquivados' ? 'Nenhum produto arquivado' : q ? 'Nada encontrado' : 'Nenhum produto ainda'}
          action={tab === 'ativos' ? <Button onClick={() => actions.openProduct({ initialName: q })}>Cadastrar produto</Button> : undefined}
        >
          {tab === 'arquivados' ? 'Produtos arquivados saem das buscas e sugestões, mas mantêm o histórico.' : 'Cadastre o que você compra com a embalagem certa para comparar o preço por kg, litro ou unidade.'}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-6">
          {grouped.map(([cat, items]) => (
            <section key={cat} aria-label={cat}>
              <h2 className="mb-2 text-sm font-semibold text-muted">{cat}</h2>
              <ul className="divide-y divide-line overflow-hidden rounded-lg bg-surface shadow-card">
                {items.map((p) => (
                  <li key={p.id}>
                    <Link to={`/produtos/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-sunken">
                      {p.image ? <img src={p.image} alt="" className="h-10 w-10 rounded-md object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-md bg-sunken"><Package className="h-4 w-4 text-muted" aria-hidden /></span>}
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{p.name}</div>
                        <div className="truncate text-xs text-muted">{[p.brandId ? brands.get(p.brandId)?.name : null, packageLabel(p)].filter(Boolean).join(' · ')}</div>
                      </div>
                      <Chip>{counts.get(p.id) ?? 0} preço{(counts.get(p.id) ?? 0) === 1 ? '' : 's'}</Chip>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
