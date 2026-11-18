import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Fuel, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { db } from '@/db/database';
import { hasCoords } from '@/services/geo';
import { Map as MapIcon } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button, Card, ChangeBadge, Chip, EmptyState, IconButton, ListSkeleton, PlaceMark, Section, useFeedback } from '@/design-system';
import { useActions } from '@/features/forms/ActionsContext';
import { FavoriteButton } from '@/features/places/FavoriteButton';
import { useFuelPrices } from '@/hooks/useData';
import { FUEL_LABEL, fuelUnit, rankStations } from '@/services/fuel';
import { byRecent, priceChange } from '@/services/comparison';
import { deleteFuelPrice } from '@/repositories/prices';
import { deletePlace } from '@/repositories/places';
import { FUEL_TYPES } from '@/types';
import { formatDateTime, relativeDays } from '@/utils/date';
import { money3 } from '@/utils/format';

export default function StationDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const actions = useActions();
  const { toast, confirm } = useFeedback();
  const station = useLiveQuery(() => db.stores.get(id).then((s) => s ?? null), [id]);
  const all = useFuelPrices();
  const mine = useMemo(() => (all ?? []).filter((r) => r.stationId === id).sort(byRecent), [all, id]);

  if (station === undefined || !all) return <div className="pt-9"><ListSkeleton /></div>;
  if (station === null)
    return (
      <div className="pt-9">
        <EmptyState icon={<Fuel className="h-6 w-6" />} title="Posto não encontrado" action={<Button onClick={() => navigate('/lugares')}>Ver lugares</Button>} />
      </div>
    );

  const fuels = FUEL_TYPES.filter((f) => mine.some((r) => r.fuel === f));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back
        title={station.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {!station.active && <Chip>inativo</Chip>}
            {[station.flag, station.address, station.neighborhood, station.city].filter(Boolean).join(' · ') || 'Sem endereço'}
          </span>
        }
        actions={
          <>
            <FavoriteButton place={station} />
            <IconButton label="Editar posto" onClick={() => actions.openPlace({ placeId: station.id })}>
              <Pencil className="h-5 w-5" />
            </IconButton>
          </>
        }
      />
      <div className="flex items-center gap-3">
        <PlaceMark name={station.name} color={station.color} logo={station.logo} size={48} />
        <Button className="flex-1" icon={<Plus className="h-4 w-4" />} onClick={() => actions.openFuel({ stationId: station.id })}>
          Registrar preço
        </Button>
      </div>

      {fuels.length ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {fuels.map((f) => {
            const recs = mine.filter((r) => r.fuel === f);
            const rank = rankStations(all.filter((r) => r.fuel === f), f);
            const pos = rank.findIndex((q) => q.stationId === id);
            const change = recs[1] ? priceChange(recs[1].price, recs[0].price) : null;
            return (
              <Card key={f} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold text-muted">{FUEL_LABEL[f]}</span>
                  {rank.length > 1 && (pos === 0 ? <Chip tone="good">mais barato</Chip> : <Chip>{pos + 1}º de {rank.length}</Chip>)}
                </div>
                <div className="price mt-1 text-2xl font-bold">
                  {money3(recs[0].price)}
                  <span className="ml-1 font-sans text-xs font-normal text-muted">/{fuelUnit(f)}</span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                  {relativeDays(recs[0].date)}
                  {change && change.direction !== 'same' && <ChangeBadge change={change} />}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted">Nenhum preço registrado neste posto.</p>
      )}

      {mine.length > 0 && (
        <Section title={`Histórico (${mine.length})`} id="historico-posto">
          <Card className="divide-y divide-line">
            {mine.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold">{FUEL_LABEL[r.fuel]}</div>
                  <div className="text-xs text-muted">
                    {formatDateTime(r.date)}
                    {r.promo ? ' · promoção' : ''}
                    {r.notes ? ` · ${r.notes}` : ''}
                  </div>
                </div>
                <span className="price font-bold">{money3(r.price)}</span>
                <IconButton label="Editar registro" onClick={() => actions.openFuel({ recordId: r.id })}>
                  <Pencil className="h-4 w-4" />
                </IconButton>
                <IconButton
                  label="Excluir registro"
                  onClick={async () => {
                    if (await confirm({ title: 'Excluir este preço?', message: `${FUEL_LABEL[r.fuel]} ${money3(r.price)} em ${formatDateTime(r.date)}.`, confirmLabel: 'Excluir', danger: true })) {
                      await deleteFuelPrice(r.id);
                      toast('Preço excluído');
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </div>
            ))}
          </Card>
        </Section>
      )}

      <div className="flex flex-wrap gap-2 border-t border-line pt-5">
        {station.address && (
          <a
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line px-3 text-sm font-semibold hover:bg-sunken"
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([station.name, station.address, station.city].filter(Boolean).join(', '))}`}
            target="_blank"
            rel="noreferrer noopener"
          >
            <MapPin className="h-4 w-4" aria-hidden />
            Abrir no mapa
          </a>
        )}
        {hasCoords(station) && (
          <Link
            to={`/mapa?lugar=${station.id}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line px-3 text-sm font-semibold hover:bg-sunken"
          >
            <MapIcon className="h-4 w-4" aria-hidden />
            Ver no mapa
          </Link>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="text-danger"
          icon={<Trash2 className="h-4 w-4" />}
          onClick={async () => {
            if (await confirm({ title: `Excluir ${station.name}?`, message: `Os ${mine.length} preços deste posto também serão apagados.`, confirmLabel: 'Excluir', danger: true })) {
              await deletePlace(station.id);
              toast('Posto excluído');
              navigate('/lugares', { replace: true });
            }
          }}
        >
          Excluir posto
        </Button>
      </div>
    </div>
  );
}
