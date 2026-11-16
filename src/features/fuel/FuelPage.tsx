import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Calculator, Fuel, MapPin, Plus } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button, Card, ChangeBadge, Chip, EmptyState, ListSkeleton, PlaceMark, PriceTag, Section, TextField, cx } from '@/design-system';
import { useActions } from '@/features/forms/ActionsContext';
import { SegmentTabs } from '@/features/compare/SegmentTabs';
import { useSettings } from '@/app/SettingsContext';
import { useFuelPrices, useMapById, useStations } from '@/hooks/useData';
import { FUEL_LABEL, FUEL_SHORT, flexCompare, fuelUnit, rankStations, tankSavings } from '@/services/fuel';
import { FUEL_TYPES, type FuelType } from '@/types';
import { formatDateTime, relativeDays } from '@/utils/date';
import { money, money3, parseDecimal, percent, toInputDecimal } from '@/utils/format';

const FUEL_STALE_DAYS = 7;

export default function FuelPage() {
  const actions = useActions();
  const [params, setParams] = useSearchParams();
  const stations = useStations();
  const stationMap = useMapById(stations);
  const records = useFuelPrices();
  const { settings } = useSettings();

  const available = useMemo(() => FUEL_TYPES.filter((f) => records?.some((r) => r.fuel === f)), [records]);
  const fuel = (params.get('f') as FuelType) || available[0] || 'gasolina_comum';
  const activeRecords = useMemo(() => (records ?? []).filter((r) => stationMap.get(r.stationId)?.active), [records, stationMap]);
  const ranking = useMemo(() => rankStations(activeRecords, fuel, FUEL_STALE_DAYS), [activeRecords, fuel]);
  const best = ranking[0];
  const worst = ranking[ranking.length - 1];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Combustíveis"
        subtitle="Preços que você anotou nas bombas, com data e hora."
        actions={
          <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => actions.openFuel({ fuel })}>
            Preço
          </Button>
        }
      />
      <div className="-mt-2">
        <SegmentTabs active="fuel" />
      </div>

      {!stations || !records ? (
        <ListSkeleton />
      ) : !stations.length ? (
        <EmptyState
          icon={<Fuel className="h-6 w-6" />}
          title="Nenhum posto cadastrado"
          action={<Button onClick={() => actions.openPlace({ mode: 'fuel' })}>Cadastrar posto</Button>}
        >
          Cadastre os postos do seu caminho e anote o preço da bomba quando passar por eles.
        </EmptyState>
      ) : (
        <>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 scrollbar-none md:mx-0 md:px-0" role="tablist" aria-label="Combustível">
            {FUEL_TYPES.map((f) => (
              <button
                key={f}
                role="tab"
                aria-selected={f === fuel}
                onClick={() => setParams({ f }, { replace: true })}
                className={cx(
                  'h-9 shrink-0 rounded-full border px-3.5 text-sm font-semibold transition-colors',
                  f === fuel ? 'border-transparent bg-primary text-on-primary' : 'border-line bg-surface text-muted hover:text-ink',
                  !available.includes(f) && f !== fuel && 'opacity-60',
                )}
              >
                {FUEL_SHORT[f]}
              </button>
            ))}
          </div>

          <section aria-labelledby="ranking" role="tabpanel">
            <h2 id="ranking" className="sr-only">
              Ranking de {FUEL_LABEL[fuel]}
            </h2>
            {ranking.length ? (
              <Card className="divide-y divide-line overflow-hidden">
                {ranking.map((q, i) => {
                  const st = stationMap.get(q.stationId)!;
                  return (
                    <Link key={q.stationId} to={`/lugares/${q.stationId}`} className={cx('flex items-center gap-3 px-4 py-3.5 hover:bg-sunken', i === 0 && 'bg-lime/[.07]')}>
                      <PlaceMark name={st.name} color={st.color} size={38} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{st.name}</div>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                          {st.flag && <span>{st.flag} ·</span>}
                          <time dateTime={q.record.date} title={formatDateTime(q.record.date)}>
                            {relativeDays(q.record.date)}
                          </time>
                          {q.stale && <Chip tone="warn">+{FUEL_STALE_DAYS} dias</Chip>}
                          {q.record.promo && <Chip tone="lime">promoção</Chip>}
                          {q.change && q.change.direction !== 'same' && <ChangeBadge change={q.change} />}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-0.5">
                        {i === 0 ? (
                          <PriceTag value={money3(q.record.price)} tone="best" size="sm" />
                        ) : (
                          <span className="price text-lg font-bold">{money3(q.record.price)}</span>
                        )}
                        <span className="text-[11px] text-muted">{i === 0 ? 'menor registrado' : `+${money3(q.diffToBest)}/${fuelUnit(fuel)}`}</span>
                      </div>
                    </Link>
                  );
                })}
              </Card>
            ) : (
              <EmptyState
                icon={<Fuel className="h-6 w-6" />}
                title={`Nenhum preço de ${FUEL_LABEL[fuel].toLowerCase()}`}
                action={<Button onClick={() => actions.openFuel({ fuel })}>Registrar preço</Button>}
              />
            )}
            {ranking.length > 0 && (
              <p className="mt-2 text-xs text-muted">
                Último preço anotado em cada posto. “Menor registrado” não garante o preço de agora — confira a data.
              </p>
            )}
          </section>

          {best && worst && ranking.length > 1 && best.record.price < worst.record.price && (
            <Section title="Quanto você economiza" id="economia-tanque">
              <Card className="p-4">
                <p className="text-sm text-muted">
                  Abastecendo no <strong className="text-ink">{stationMap.get(best.stationId)?.name}</strong> em vez do{' '}
                  <strong className="text-ink">{stationMap.get(worst.stationId)?.name}</strong> ({money3(worst.record.price - best.record.price)} a menos por{' '}
                  {fuelUnit(fuel) === 'L' ? 'litro' : 'm³'}):
                </p>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {settings.tankSizes.map((l) => (
                    <div key={l} className="rounded-lg bg-sunken p-3 text-center">
                      <div className="text-xs font-semibold text-muted">{l} {fuelUnit(fuel)}</div>
                      <div className="price mt-1 text-xl font-bold text-lime-ink">{money(tankSavings(best.record.price, worst.record.price, l))}</div>
                    </div>
                  ))}
                </div>
                {ranking.length > 2 && (
                  <p className="mt-3 text-xs text-muted">
                    Contra o segundo mais barato, a diferença em {settings.tankSizes[1] ?? 40} {fuelUnit(fuel)} é de{' '}
                    {money(tankSavings(best.record.price, ranking[1].record.price, settings.tankSizes[1] ?? 40))}.
                  </p>
                )}
              </Card>
            </Section>
          )}

          <FlexCalculator records={activeRecords} ratio={settings.flexRatio} />

          <Link to="/lugares?tipo=seg-combustivel" className="flex items-center gap-3 rounded-lg border border-line p-4 text-sm font-semibold hover:bg-sunken">
            <MapPin className="h-5 w-5 text-accent" aria-hidden />
            Gerenciar postos ({stations.length})
          </Link>
        </>
      )}
    </div>
  );
}

function FlexCalculator({ records, ratio }: { records: Parameters<typeof rankStations>[0]; ratio: number }) {
  const { update } = useSettings();
  const bestE = rankStations(records, 'etanol', FUEL_STALE_DAYS)[0];
  const bestG = rankStations(records, 'gasolina_comum', FUEL_STALE_DAYS)[0];
  const [ethanol, setEthanol] = useState(bestE ? toInputDecimal(bestE.record.price, 3) : '');
  const [gasoline, setGasoline] = useState(bestG ? toInputDecimal(bestG.record.price, 3) : '');
  const [eff, setEff] = useState(String(Math.round(ratio * 100)));
  const [kmE, setKmE] = useState('');
  const [kmG, setKmG] = useState('');

  const e = parseDecimal(ethanol);
  const g = parseDecimal(gasoline);
  const efficiency = parseDecimal(eff) / 100;
  const result = e > 0 && g > 0 && efficiency > 0 && efficiency < 1.5 ? flexCompare(e, g, efficiency, { etanol: parseDecimal(kmE), gasolina: parseDecimal(kmG) }) : null;

  return (
    <Section title="Etanol ou gasolina?" id="flex">
      <Card className="p-4">
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Etanol" prefix="R$" inputMode="decimal" value={ethanol} onChange={(ev) => setEthanol(ev.target.value)} />
          <TextField label="Gasolina" prefix="R$" inputMode="decimal" value={gasoline} onChange={(ev) => setGasoline(ev.target.value)} />
          <TextField
            label="Rendimento do etanol"
            suffix="%"
            inputMode="numeric"
            value={eff}
            onChange={(ev) => setEff(ev.target.value)}
            onBlur={() => {
              const v = parseDecimal(eff) / 100;
              if (v > 0.4 && v < 1) void update({ flexRatio: v });
            }}
            hint="70% é só uma referência comum. O ideal é medir no seu carro."
            wrapperClassName="col-span-2"
          />
          <TextField label="Km/L com etanol" optional inputMode="decimal" value={kmE} onChange={(ev) => setKmE(ev.target.value)} />
          <TextField label="Km/L com gasolina" optional inputMode="decimal" value={kmG} onChange={(ev) => setKmG(ev.target.value)} />
        </div>
        {result ? (
          <div className="mt-4 flex items-start gap-3 rounded-lg bg-sunken p-4" aria-live="polite">
            <Calculator className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
            <div className="text-sm">
              <p className="text-base font-bold">
                {result.best === 'indiferente' ? 'Tanto faz' : result.best === 'etanol' ? 'Etanol compensa' : 'Gasolina compensa'}
              </p>
              <p className="mt-1 text-muted">
                O etanol custa {percent(result.ratio)} do preço da gasolina; o limite para o seu carro é {percent(result.threshold)}
                {result.costPerKm ? ' (pelo consumo informado)' : ''}. Com a gasolina a {money3(g)}, o etanol compensa até {money3(result.maxEthanolPrice)}.
              </p>
              {result.costPerKm && (
                <p className="mt-1 text-muted">
                  Custo por km: etanol {money3(result.costPerKm.etanol)} · gasolina {money3(result.costPerKm.gasolina)}.
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted">Informe os dois preços para comparar.</p>
        )}
        {(bestE || bestG) && <p className="mt-2 text-xs text-muted">Preenchido com o menor preço registrado de cada um.</p>}
      </Card>
    </Section>
  );
}
