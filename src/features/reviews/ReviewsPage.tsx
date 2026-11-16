import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Ban, Heart, Star } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, Chip, EmptyState, ListSkeleton, Segmented, Stars } from '@/design-system';
import { useActions } from '@/features/forms/ActionsContext';
import { useBrands, useMapById, useProducts, useReviews } from '@/hooks/useData';
import { reviewScore } from '@/services/recommendations';
import { formatDate } from '@/utils/date';

type Filter = 'todas' | 'favoritos' | 'evitar';

export default function ReviewsPage() {
  const actions = useActions();
  const reviews = useReviews();
  const products = useMapById(useProducts());
  const brands = useMapById(useBrands());
  const [filter, setFilter] = useState<Filter>('todas');

  const list = (reviews ?? [])
    .filter((r) => (filter === 'favoritos' ? r.favorite : filter === 'evitar' ? r.avoid : true))
    .sort((a, b) => reviewScore(b) - reviewScore(a));

  return (
    <div>
      <PageHeader back="/mais" title="Avaliações" subtitle="Suas notas pessoais. Ficam só neste aparelho." />
      <Segmented
        label="Filtro"
        value={filter}
        onChange={setFilter}
        className="mb-4"
        options={[
          { value: 'todas', label: 'Todas' },
          { value: 'favoritos', label: 'Favoritos' },
          { value: 'evitar', label: 'Não comprar' },
        ]}
      />
      {!reviews ? (
        <ListSkeleton />
      ) : !list.length ? (
        <EmptyState icon={<Star className="h-6 w-6" />} title={filter === 'todas' ? 'Nenhuma avaliação ainda' : 'Nada por aqui'}>
          Abra um produto e toque em “Avaliar produto”. As notas melhoram as sugestões do comparador.
        </EmptyState>
      ) : (
        <Card className="divide-y divide-line">
          {list.map((r) => {
            const isProduct = r.targetType === 'product';
            const name = isProduct ? products.get(r.targetId)?.name : brands.get(r.targetId)?.name;
            const body = (
              <>
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold">{name ?? 'Item removido'}</span>
                  <Chip>{isProduct ? 'produto' : 'marca'}</Chip>
                  {r.favorite && <Heart className="h-3.5 w-3.5 fill-current text-danger" aria-label="Favorito" />}
                  {r.avoid && <Ban className="h-3.5 w-3.5 text-danger" aria-label="Não comprar novamente" />}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                  <Stars value={reviewScore(r)} size={12} />
                  <span>
                    geral {r.overall}
                    {r.quality ? ` · qualidade ${r.quality}` : ''}
                    {r.value ? ` · custo-benefício ${r.value}` : ''} · {formatDate(r.date)}
                  </span>
                </div>
                {r.comment && <p className="mt-1 line-clamp-2 text-sm">{r.comment}</p>}
              </>
            );
            return isProduct ? (
              <Link key={r.id} to={`/produtos/${r.targetId}`} className="block px-4 py-3 hover:bg-sunken">
                {body}
              </Link>
            ) : (
              <button key={r.id} onClick={() => actions.openReview({ targetType: 'brand', targetId: r.targetId })} className="block w-full px-4 py-3 text-left hover:bg-sunken">
                {body}
              </button>
            );
          })}
        </Card>
      )}
    </div>
  );
}
