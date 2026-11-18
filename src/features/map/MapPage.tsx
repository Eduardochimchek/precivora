import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, Navigation, Star } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button, Card, PlaceMark, SegmentIcon, cx, useFeedback } from '@/design-system';
import { useFuelPrices, usePlaces, useSegments } from '@/hooks/useData';
import { currentPosition, lastKnownPosition } from '@/app/location';
import { GEOCODE_EVENT, geocodeStatus, runGeocoding, type GeocodeProgress } from '@/app/geocodeRunner';
import { distanceKm, formatDistance, hasCoords, PRECISION_LABEL, type LatLng } from '@/services/geo';
import { FUEL_SHORT } from '@/services/fuel';
import { FUEL_TYPES, type FuelType, type ID, type Place } from '@/types';
import { money3 } from '@/utils/format';

const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export default function MapPage() {
  const [params, setParams] = useSearchParams();
  const { toast } = useFeedback();
  const segments = useSegments() ?? [];
  const places = usePlaces();
  const fuelPrices = useFuelPrices();
  const filter = params.get('tipo') ?? '';
  const onlyFav = params.get('fav') === '1';
  const fuel = (params.get('f') as FuelType) || 'gasolina_comum';
  const [selected, setSelected] = useState<ID | null>(params.get('lugar'));
  const [me, setMe] = useState<LatLng | undefined>(lastKnownPosition());
  const [locating, setLocating] = useState(false);
  const [progress, setProgress] = useState<GeocodeProgress | null>(null);

  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const meLayer = useRef<L.LayerGroup | null>(null);
  const fitted = useRef(false);

  const segMode = useMemo(() => new Map(segments.map((s) => [s.id, s.mode])), [segments]);
  const fuelSelected = filter ? segMode.get(filter) === 'fuel' : false;

  const latestFuel = useMemo(() => {
    const m = new Map<ID, number>();
    const sorted = [...(fuelPrices ?? [])].filter((r) => r.fuel === fuel).sort((a, b) => b.date.localeCompare(a.date));
    for (const r of sorted) if (!m.has(r.stationId)) m.set(r.stationId, r.price);
    return m;
  }, [fuelPrices, fuel]);

  const visible = useMemo(
    () => (places ?? []).filter((p) => p.active && hasCoords(p) && p.geo !== 'none' && (!filter || p.segmentId === filter) && (!onlyFav || p.favorite)),
    [places, filter, onlyFav],
  );
  const withoutCoords = (places ?? []).filter((p) => p.active && (!filter || p.segmentId === filter) && !hasCoords(p)).length;

  useEffect(() => {
    if (!mapEl.current || map.current) return;
    const m = L.map(mapEl.current, { zoomControl: false, attributionControl: true, preferCanvas: true }).setView([-28.68, -49.37], 12);
    L.control.zoom({ position: 'bottomright' }).addTo(m);
    L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 19, className: 'map-tiles' }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    meLayer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const onProgress = (e: Event) => setProgress((e as CustomEvent<GeocodeProgress>).detail);
    window.addEventListener(GEOCODE_EVENT, onProgress);
    void geocodeStatus().then(setProgress);
    if (!navigator.webdriver) void runGeocoding();
    return () => window.removeEventListener(GEOCODE_EVENT, onProgress);
  }, []);

  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    for (const p of visible) {
      const price = segMode.get(p.segmentId) === 'fuel' ? latestFuel.get(p.id) : undefined;
      const approx = p.geo !== 'exact';
      if (price !== undefined) {
        const icon = L.divIcon({
          className: '',
          html: `<span class="map-price${p.favorite ? ' fav' : ''}" style="--c:${p.color}">${money3(price).replace('R$', '').trim()}</span>`,
          iconSize: undefined,
          iconAnchor: [24, 14],
        });
        L.marker([p.lat!, p.lng!], { icon, keyboard: false }).on('click', () => setSelected(p.id)).addTo(g);
      } else {
        L.circleMarker([p.lat!, p.lng!], {
          radius: p.favorite ? 9 : 7,
          color: p.favorite ? '#F5B301' : '#ffffff',
          weight: p.favorite ? 3 : 2,
          fillColor: p.color,
          fillOpacity: approx ? 0.7 : 1,
          dashArray: approx ? '3 3' : undefined,
        })
          .on('click', () => setSelected(p.id))
          .addTo(g);
      }
    }
    const focus = selected ? visible.find((p) => p.id === selected) : undefined;
    if (focus) m.setView([focus.lat!, focus.lng!], Math.max(m.getZoom(), 15));
    else if (!fitted.current && visible.length) {
      m.fitBounds(L.latLngBounds(visible.map((p) => [p.lat!, p.lng!] as [number, number])), { padding: [24, 24], maxZoom: 15 });
      fitted.current = true;
    }
  }, [visible, latestFuel, segMode]);

  useEffect(() => {
    const g = meLayer.current;
    if (!g) return;
    g.clearLayers();
    if (me) {
      L.circleMarker([me.lat, me.lng], { radius: 8, color: '#ffffff', weight: 3, fillColor: '#2563EB', fillOpacity: 1 }).addTo(g);
    }
  }, [me]);

  async function locate() {
    setLocating(true);
    try {
      const p = await currentPosition();
      setMe(p);
      map.current?.setView([p.lat, p.lng], 14);
    } catch (err) {
      toast((err as Error).message || 'Não consegui pegar a localização.', 'error');
    } finally {
      setLocating(false);
    }
  }

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
    next.delete('lugar');
    setParams(next, { replace: true });
  };

  const sel = selected ? (places ?? []).find((p) => p.id === selected) : undefined;

  return (
    <div className="flex flex-col gap-3">
      <PageHeader back="/mais" title="Mapa" subtitle={places ? `${visible.length} lugar${visible.length === 1 ? '' : 'es'} no mapa` : undefined} />
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none md:mx-0 md:flex-wrap md:px-0" role="tablist" aria-label="Filtro do mapa">
        <Chip active={!filter && !onlyFav} onClick={() => set({ tipo: null, fav: null })}>
          Todos
        </Chip>
        <Chip active={onlyFav} onClick={() => set({ fav: onlyFav ? null : '1' })}>
          <Star className={cx('h-4 w-4', onlyFav ? 'fill-current' : 'fill-[#F5B301] text-[#F5B301]')} /> Favoritos
        </Chip>
        {segments.map((s) => (
          <Chip key={s.id} active={filter === s.id} onClick={() => set({ tipo: filter === s.id ? null : s.id })}>
            <SegmentIcon icon={s.icon} /> {s.name}
          </Chip>
        ))}
      </div>
      {fuelSelected && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 scrollbar-none md:mx-0 md:px-0" role="tablist" aria-label="Combustível">
          {FUEL_TYPES.map((f) => (
            <Chip key={f} small active={f === fuel} onClick={() => set({ f })}>
              {FUEL_SHORT[f]}
            </Chip>
          ))}
        </div>
      )}

      <div className="relative isolate overflow-hidden rounded-lg shadow-card">
        <div ref={mapEl} className="h-[58dvh] min-h-[320px] w-full bg-sunken" aria-label="Mapa dos lugares" role="application" />
        <Button size="sm" variant="secondary" className="absolute left-3 top-3 z-[500] shadow-card" icon={<Crosshair className="h-4 w-4" />} loading={locating} onClick={locate}>
          Perto de mim
        </Button>
      </div>

      {progress && progress.pending > 0 && (
        <p className="text-xs text-muted" aria-live="polite">
          {progress.running
            ? `Localizando endereços no mapa: faltam ${progress.pending}. Continua sozinho enquanto o app estiver aberto (1 por segundo).`
            : `${progress.pending} endereço${progress.pending === 1 ? '' : 's'} ainda sem localização. A busca continua quando o app tiver internet.`}
        </p>
      )}
      {!progress?.pending && withoutCoords > 0 && <p className="text-xs text-muted">{withoutCoords} lugar(es) sem endereço completo ficam fora do mapa.</p>}

      {sel && <SelectedCard place={sel} me={me} price={segMode.get(sel.segmentId) === 'fuel' ? latestFuel.get(sel.id) : undefined} fuel={fuel} onClose={() => setSelected(null)} />}
    </div>
  );
}

function SelectedCard({ place, me, price, fuel, onClose }: { place: Place; me?: LatLng; price?: number; fuel: FuelType; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [place.id]);
  const dist = me && hasCoords(place) ? distanceKm(me, place) : undefined;
  const route = hasCoords(place) ? `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}` : undefined;
  return (
    <div ref={ref} className="scroll-mb-24">
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <PlaceMark name={place.name} color={place.color} logo={place.logo} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 font-semibold">
            {place.favorite && <Star className="h-4 w-4 shrink-0 fill-[#F5B301] text-[#F5B301]" aria-label="Favorito" />}
            <span className="truncate">{place.name}</span>
          </div>
          <div className="text-xs text-muted">{[place.address, place.neighborhood, place.city].filter(Boolean).join(' · ')}</div>
          <div className="mt-1 text-xs text-muted">
            {dist !== undefined && <strong className="text-ink">{formatDistance(dist)} daqui · </strong>}
            {place.geo && `Localização ${PRECISION_LABEL[place.geo]}`}
          </div>
        </div>
        {price !== undefined && (
          <div className="text-right">
            <div className="price text-lg font-bold">{money3(price)}</div>
            <div className="text-[11px] text-muted">{FUEL_SHORT[fuel]}</div>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <Link to={`/lugares/${place.id}`} className="inline-flex h-10 flex-1 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-on-primary">
          Abrir
        </Link>
        {route && (
          <a href={route} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line px-4 text-sm font-semibold hover:bg-sunken">
            <Navigation className="h-4 w-4" aria-hidden /> Rotas
          </a>
        )}
        <Button variant="ghost" size="sm" className="h-10" onClick={onClose}>
          Fechar
        </Button>
      </div>
    </Card>
    </div>
  );
}

function Chip({ active, onClick, children, small }: { active: boolean; onClick: () => void; children: React.ReactNode; small?: boolean }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cx(
        'flex shrink-0 items-center gap-1.5 rounded-full border font-semibold transition-colors',
        small ? 'h-8 px-3 text-xs' : 'h-9 px-3.5 text-sm',
        active ? 'border-transparent bg-primary text-on-primary' : 'border-line bg-surface text-muted hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}
