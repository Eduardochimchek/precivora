import { useState } from 'react';
import { Pencil, Plus, Star, Tags, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button, Card, EmptyState, IconButton, ListSkeleton, Section, Segmented, SelectField, Sheet, Stars, TextField, useFeedback, cx } from '@/design-system';
import { useActions } from '@/features/forms/ActionsContext';
import { useBrands, useCategories, useMapById, useProducts, useReviews, useSegments } from '@/hooks/useData';
import { brandRating } from '@/services/recommendations';
import { deleteBrand, deleteCategory, ensureBrand, renameBrand, saveCategory } from '@/repositories/catalog';
import type { ID } from '@/types';

const CAT_COLORS = ['#D97706', '#16A34A', '#DC2626', '#0EA5E9', '#A16207', '#7C3AED', '#0891B2', '#DB2777', '#F59E0B', '#65A30D', '#475569'];

export default function BrandsPage() {
  const actions = useActions();
  const { toast, confirm } = useFeedback();
  const brands = useBrands();
  const categories = useCategories();
  const products = useProducts();
  const reviews = useReviews();
  const [tab, setTab] = useState<'marcas' | 'categorias'>('marcas');
  const segmentsList = useSegments();
  const segments = useMapById(segmentsList);
  const [editing, setEditing] = useState<{ kind: 'brand' | 'category'; id?: ID; name: string; color?: string; segmentId?: ID } | null>(null);

  async function save() {
    if (!editing) return;
    try {
      if (editing.kind === 'brand') {
        if (editing.id) await renameBrand(editing.id, editing.name);
        else await ensureBrand(editing.name);
      } else await saveCategory({ id: editing.id, name: editing.name, color: editing.color ?? CAT_COLORS[0], segmentId: editing.segmentId });
      toast('Salvo');
      setEditing(null);
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  const loading = !brands || !categories || !products || !reviews;
  return (
    <div>
      <PageHeader
        back="/mais"
        title="Marcas e categorias"
        actions={
          <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing({ kind: tab === 'marcas' ? 'brand' : 'category', name: '', color: CAT_COLORS[(categories?.length ?? 0) % CAT_COLORS.length] })}>
            Nova
          </Button>
        }
      />
      <Segmented label="Mostrar" value={tab} onChange={setTab} options={[{ value: 'marcas', label: 'Marcas' }, { value: 'categorias', label: 'Categorias' }]} className="mb-4" />
      {loading ? (
        <ListSkeleton />
      ) : tab === 'marcas' ? (
        brands.length ? (
          <Section title={`${brands.length} marcas`} id="marcas">
            <p className="-mt-1 text-xs text-muted">A nota combina a avaliação da marca com as dos produtos dela.</p>
            <Card className="divide-y divide-line">
              {brands.map((b) => {
                const r = brandRating(b.id, products, reviews);
                const own = reviews.find((x) => x.targetType === 'brand' && x.targetId === b.id);
                const n = products.filter((p) => p.brandId === b.id).length;
                return (
                  <div key={b.id} className="flex items-center gap-2 py-2 pl-4 pr-1">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{b.name}</div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                        {r.avg != null ? (
                          <span className="flex items-center gap-1.5 whitespace-nowrap">
                            <Stars value={r.avg} size={11} />
                            {r.avg.toFixed(1).replace('.', ',')} ({r.count})
                          </span>
                        ) : (
                          <span className="whitespace-nowrap">sem avaliação</span>
                        )}
                        <span className="whitespace-nowrap">· {n} produto{n === 1 ? '' : 's'}</span>
                      </div>
                    </div>
                    <IconButton label={own ? `Editar avaliação de ${b.name}` : `Avaliar ${b.name}`} onClick={() => actions.openReview({ targetType: 'brand', targetId: b.id })}>
                      <Star className={cx('h-4 w-4', own && 'fill-amber-400 text-amber-400')} />
                    </IconButton>
                    <IconButton label={`Renomear ${b.name}`} onClick={() => setEditing({ kind: 'brand', id: b.id, name: b.name })}>
                      <Pencil className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      label={`Excluir ${b.name}`}
                      onClick={async () => {
                        if (await confirm({ title: `Excluir a marca ${b.name}?`, message: `Os ${n} produtos continuam cadastrados, só ficam sem marca.`, confirmLabel: 'Excluir', danger: true })) {
                          await deleteBrand(b.id);
                          toast('Marca excluída');
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </div>
                );
              })}
            </Card>
          </Section>
        ) : (
          <EmptyState icon={<Tags className="h-6 w-6" />} title="Nenhuma marca ainda">
            As marcas são criadas quando você cadastra um produto com marca.
          </EmptyState>
        )
      ) : (
        <Card className="divide-y divide-line">
          {categories.map((c) => {
            const n = products.filter((p) => p.categoryId === c.id).length;
            return (
              <div key={c.id} className="flex items-center gap-3 py-2 pl-4 pr-1">
                <span className="h-3 w-3 rounded-full" style={{ background: c.color }} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{c.name}</div>
                  <div className="text-xs text-muted">
                    {c.segmentId ? (segments.get(c.segmentId)?.name ?? 'Todos os tipos') : 'Todos os tipos'} · {n} produto{n === 1 ? '' : 's'}
                  </div>
                </div>
                <IconButton label={`Editar ${c.name}`} onClick={() => setEditing({ kind: 'category', id: c.id, name: c.name, color: c.color, segmentId: c.segmentId })}>
                  <Pencil className="h-4 w-4" />
                </IconButton>
                <IconButton
                  label={`Excluir ${c.name}`}
                  onClick={async () => {
                    if (await confirm({ title: `Excluir a categoria ${c.name}?`, message: `Os ${n} produtos ficam sem categoria e o limite de orçamento dela é removido.`, confirmLabel: 'Excluir', danger: true })) {
                      await deleteCategory(c.id);
                      toast('Categoria excluída');
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </div>
            );
          })}
        </Card>
      )}

      <Sheet
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Editar' : editing?.kind === 'brand' ? 'Nova marca' : 'Nova categoria'}
        footer={
          <Button block onClick={save}>
            Salvar
          </Button>
        }
      >
        {editing && (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <TextField label="Nome" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} maxLength={80} data-autofocus />
            {editing.kind === 'category' && (
              <SelectField label="Tipo de lugar" value={editing.segmentId ?? ''} onChange={(e) => setEditing({ ...editing, segmentId: e.target.value || undefined })}>
                <option value="">Todos os tipos</option>
                {segmentsList
                  ?.filter((s) => s.mode === 'items')
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </SelectField>
            )}
            {editing.kind === 'category' && (
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cor">
                {CAT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={editing.color === c}
                    aria-label={`Cor ${c}`}
                    onClick={() => setEditing({ ...editing, color: c })}
                    className={cx('h-8 w-8 rounded-full ring-offset-2 ring-offset-surface', editing.color === c && 'ring-2 ring-ink')}
                    style={{ background: c }}
                  />
                ))}
              </div>
            )}
          </form>
        )}
      </Sheet>
    </div>
  );
}
