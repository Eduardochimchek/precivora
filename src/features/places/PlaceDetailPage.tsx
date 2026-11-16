import { lazy } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { MapPin } from 'lucide-react';
import { db } from '@/db/database';
import { Button, EmptyState, ListSkeleton } from '@/design-system';

const StoreDetailPage = lazy(() => import('./StoreDetailPage'));
const StationDetailPage = lazy(() => import('@/features/fuel/StationDetailPage'));

/** Detalhe de um lugar: postos (segmento de combustível) têm tela própria. */
export default function PlaceDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const mode = useLiveQuery(async () => {
    const place = await db.stores.get(id);
    if (!place) return null;
    return (await db.segments.get(place.segmentId))?.mode ?? 'items';
  }, [id]);

  if (mode === undefined) return <div className="pt-9"><ListSkeleton /></div>;
  if (mode === null)
    return (
      <div className="pt-9">
        <EmptyState icon={<MapPin className="h-6 w-6" />} title="Lugar não encontrado" action={<Button onClick={() => navigate('/lugares')}>Ver lugares</Button>}>
          Ele pode ter sido excluído.
        </EmptyState>
      </div>
    );
  return mode === 'fuel' ? <StationDetailPage /> : <StoreDetailPage />;
}
