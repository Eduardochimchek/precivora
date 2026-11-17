import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { AlertTriangle, CheckCircle2, Keyboard, Pencil, ScanLine, Smartphone } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button, Card, Chip, PlaceMark, Section, Segmented, SelectField, Sheet, TextField, useFeedback } from '@/design-system';
import { ProductPicker } from '@/features/forms/ProductPicker';
import { PLACE_COLORS } from '@/features/forms/ColorSwatches';
import { SegmentIcon } from '@/design-system/SegmentIcon';
import { useBrands, useMapById, usePlaces, useProducts, useSegments } from '@/hooks/useData';
import { isNative } from '@/app/native';
import { fetchReceiptPage, scanReceiptQr, ScanCancelled } from '@/app/nfceNative';
import { draftFromReceipt, fuelDecisions, importReceipt, type ItemDecision, type ReceiptDraft } from '@/repositories/receipts';
import { consultationUrl, parseReceiptHtml } from '@/services/nfce';
import { FUEL_LABEL } from '@/services/fuel';
import { UNIT_INFO } from '@/services/units';
import { FUEL_TYPES, type Brand, type FuelType, type ID, type Product } from '@/types';
import { formatDate, fromDateInput, toDateInput } from '@/utils/date';
import { money } from '@/utils/format';
import { cx } from '@/design-system/cx';

type Step = { kind: 'start' } | { kind: 'loading'; message: string } | { kind: 'review'; draft: ReceiptDraft };

const qty = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });

const withPackage = (name: string, size: number, unit: string) => {
  const pkg = `${size.toLocaleString('pt-BR')} ${unit}`;
  return name.toLowerCase().replace(/\s/g, '').includes(pkg.toLowerCase().replace(/\s/g, '')) ? name : `${name} · ${pkg}`;
};

export default function ImportReceiptPage() {
  const [step, setStep] = useState<Step>({ kind: 'start' });
  const [typedKey, setTypedKey] = useState('');
  const [error, setError] = useState('');
  const [params, setParams] = useSearchParams();
  const autoStarted = useRef(false);
  const places = useMapById(usePlaces());
  const recent = useLiveQuery(() => db.purchases.orderBy('date').reverse().filter((p) => !!p.receiptKey).limit(5).toArray(), []);

  useEffect(() => {
    if (!isNative || autoStarted.current || params.get('auto') !== '1') return;
    autoStarted.current = true;
    setParams({}, { replace: true });
    void scan();
  }, []);

  async function run(input: string) {
    setError('');
    try {
      const { url, key, needsKeyTyping } = consultationUrl(input);
      if (needsKeyTyping && key) await navigator.clipboard?.writeText(key).catch(() => undefined);
      setStep({ kind: 'loading', message: 'Abrindo a nota no site da Fazenda…' });
      const html = await fetchReceiptPage(url, needsKeyTyping ? key : undefined);
      setStep({ kind: 'loading', message: 'Lendo a nota…' });
      const receipt = parseReceiptHtml(html);
      if (!receipt.accessKey && key) receipt.accessKey = key;
      setStep({ kind: 'review', draft: await draftFromReceipt(receipt) });
    } catch (err) {
      setStep({ kind: 'start' });
      if (!(err instanceof ScanCancelled)) setError((err as Error).message || 'Não foi possível ler a nota.');
    }
  }

  async function scan() {
    setError('');
    try {
      const raw = await scanReceiptQr();
      await run(raw);
    } catch (err) {
      if (!(err instanceof ScanCancelled)) setError((err as Error).message || 'Não foi possível ler o QR Code.');
    }
  }

  if (step.kind === 'review') return <ReceiptReview draft={step.draft} onRestart={() => setStep({ kind: 'start' })} />;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader back="/historico" title="Importar nota fiscal" subtitle="Escaneie o QR Code do cupom (NFC-e) e o app traz o lugar, os produtos e os preços." />
      {!isNative ? (
        <Card className="flex items-start gap-3 p-4">
          <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
          <p className="text-sm">
            A importação de nota fiscal funciona no <strong>app Android</strong> do Precivora. No navegador, os sites da Fazenda não deixam outro site ler a nota.
          </p>
        </Card>
      ) : step.kind === 'loading' ? (
        <Card className="flex items-center gap-3 p-5" aria-live="polite">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-accent" aria-hidden />
          <span className="text-sm font-semibold">{step.message}</span>
        </Card>
      ) : (
        <>
          <Button size="lg" block icon={<ScanLine className="h-5 w-5" />} onClick={scan}>
            Escanear QR Code do cupom
          </Button>
          <Section title="Ou digite a chave de acesso">
            <Card className="flex flex-col gap-3 p-4">
              <TextField
                label="Chave de acesso (44 números)"
                inputMode="numeric"
                autoComplete="off"
                value={typedKey}
                onChange={(e) => setTypedKey(e.target.value)}
                hint="Fica embaixo do QR Code, em grupos de 4 números."
              />
              <Button variant="secondary" className="self-start" icon={<Keyboard className="h-4 w-4" />} disabled={typedKey.replace(/\D/g, '').length !== 44} onClick={() => run(typedKey)}>
                Consultar pela chave
              </Button>
              <p className="text-xs text-muted">Depois da validação de segurança do site, o app preenche a chave e consulta sozinho. Ela também fica copiada, caso precise colar.</p>
            </Card>
          </Section>
          <p className="text-xs text-muted">
            A consulta é feita direto no site da Secretaria da Fazenda, sem passar por nenhum servidor do Precivora. Se o site pedir, passe pela verificação de segurança; quando a nota aparecer, o app lê sozinho.
          </p>
          {!!recent?.length && (
            <Section title="Últimas notas importadas">
              <Card as="section" className="divide-y divide-line">
                {recent.map((p) => {
                  const place = places.get(p.storeId);
                  return (
                    <Link key={p.id} to={`/compras/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-sunken">
                      <PlaceMark name={place?.name ?? '?'} color={place?.color ?? '#64748B'} size={34} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{place?.name ?? 'Lugar removido'}</div>
                        <div className="text-xs text-muted">{formatDate(p.date)}</div>
                      </div>
                      <div className="price tnum font-bold">{money(p.total)}</div>
                    </Link>
                  );
                })}
              </Card>
            </Section>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-danger/10 p-3 text-sm text-danger">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {error}
        </p>
      )}
    </div>
  );
}

export function ReceiptReview({ draft, onRestart }: { draft: ReceiptDraft; onRestart: () => void }) {
  const navigate = useNavigate();
  const { toast } = useFeedback();
  const segments = useSegments();
  const places = usePlaces();
  const products = useProducts();
  const brands = useMapById(useBrands());
  const productMap = useMapById(products);
  const { receipt } = draft;

  const [placeId, setPlaceId] = useState<ID | ''>(draft.placeId ?? '');
  const [newName, setNewName] = useState(receipt.store.name);
  const [segmentId, setSegmentId] = useState<ID>(draft.suggestedSegmentId);
  const [date, setDate] = useState(toDateInput(receipt.issuedAt ?? new Date()));
  const [itemDecisions, setItemDecisions] = useState<ItemDecision[]>(() => draft.items.map((i) => i.decision));
  const [fuelDecs, setFuelDecs] = useState<ItemDecision[]>(() => fuelDecisions(draft));
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);

  const place = places?.find((p) => p.id === placeId);
  const effectiveSegment = segments?.find((s) => s.id === (place?.segmentId ?? segmentId));
  const fuelMode = effectiveSegment?.mode === 'fuel';
  const decisions = fuelMode ? fuelDecs : itemDecisions;
  const chosen = decisions.filter((d) => d.action !== 'skip').length;
  const counts = { link: decisions.filter((d) => d.action === 'link').length, new: decisions.filter((d) => d.action === 'new').length, skip: decisions.filter((d) => d.action === 'skip').length };
  const incomplete = decisions.some((d) => (d.action === 'link' && !d.productId) || (d.action === 'new' && !d.name.trim())) || (!placeId && !newName.trim());
  const total = useMemo(
    () => Math.round(draft.items.reduce((s, it, i) => s + (decisions[i]?.action === 'skip' ? 0 : it.item.total), 0) * 100) / 100,
    [draft.items, decisions],
  );

  const setItem = (i: number, d: ItemDecision) => setItemDecisions((ds) => ds.map((x, j) => (j === i ? d : x)));
  const setFuel = (i: number, d: ItemDecision) => setFuelDecs((ds) => ds.map((x, j) => (j === i ? d : x)));

  async function save() {
    setSaving(true);
    try {
      const sameDay = receipt.issuedAt && toDateInput(receipt.issuedAt) === date;
      const res = await importReceipt({
        receipt,
        placeId: placeId || undefined,
        newPlace: placeId ? undefined : { name: newName, segmentId, color: PLACE_COLORS[(places?.length ?? 0) % PLACE_COLORS.length] },
        date: sameDay ? receipt.issuedAt! : fromDateInput(date),
        decisions,
      });
      toast(`Nota importada: ${res.imported} ${res.imported === 1 ? 'item' : 'itens'}`);
      navigate(fuelMode ? '/combustiveis' : '/historico', { replace: true, state: res.purchaseId ? { highlight: res.purchaseId } : undefined });
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }


  return (
    <div className="flex flex-col gap-5">
      <PageHeader back="/historico" title="Conferir nota" subtitle={receipt.number ? `NFC-e nº ${receipt.number}` : 'Confira antes de salvar'} />

      {draft.alreadyImported && (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-warn/[.12] p-3 text-sm text-warn">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> Esta nota já foi importada antes.
        </p>
      )}

      <Section title="Lugar">
        <Card className="flex flex-col gap-4 p-4">
          {place ? (
            <div className="flex items-center gap-3">
              <PlaceMark name={place.name} color={place.color} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{place.name}</div>
                <div className="text-xs text-muted">{[place.neighborhood, place.city].filter(Boolean).join(' · ') || effectiveSegment?.name}</div>
              </div>
              {draft.placeId === place.id && <Chip tone="good" icon={<CheckCircle2 className="h-3.5 w-3.5" />}>Pelo CNPJ</Chip>}
            </div>
          ) : (
            <>
              <TextField label="Nome do lugar" value={newName} onChange={(e) => setNewName(e.target.value)} hint={[receipt.store.address, receipt.store.neighborhood, receipt.store.city].filter(Boolean).join(' · ')} />
              <fieldset>
                <legend className="mb-2 text-sm font-semibold">Tipo</legend>
                <div className="flex flex-wrap gap-2">
                  {(segments ?? []).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={segmentId === s.id}
                      onClick={() => setSegmentId(s.id)}
                      className={cx(
                        'inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition-colors',
                        segmentId === s.id ? 'border-transparent bg-navy text-[#F1F5F9] dark:bg-lime dark:text-navy' : 'border-line bg-surface text-ink hover:bg-sunken',
                      )}
                    >
                      <SegmentIcon icon={s.icon} className="h-4 w-4" /> {s.name}
                    </button>
                  ))}
                </div>
              </fieldset>
            </>
          )}
          {!!places?.length && (
          <SelectField label={place ? 'Lugar' : 'Ou usar um lugar já cadastrado'} value={placeId} onChange={(e) => setPlaceId(e.target.value)}>
            <option value="">Cadastrar lugar novo com os dados da nota</option>
            {(places ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </SelectField>
          )}
          <TextField label="Data da compra" type="date" value={date} max={toDateInput()} onChange={(e) => setDate(e.target.value)} />
        </Card>
      </Section>

      <Section
        title={`Itens (${draft.items.length})`}
        action={
          !fuelMode && (
            <span className="text-xs text-muted">
              {counts.link ? `${counts.link} reconhecido${counts.link > 1 ? 's' : ''} · ` : ''}
              {counts.new} novo{counts.new === 1 ? '' : 's'}
              {counts.skip ? ` · ${counts.skip} ignorado${counts.skip > 1 ? 's' : ''}` : ''}
            </span>
          )
        }
      >
        <p className="-mt-1 mb-3 text-xs text-muted">Toque em um item para trocar o produto ou ignorá-lo.</p>
        <Card as="section" className="divide-y divide-line" aria-label="Itens da nota">
          {draft.items.map((it, i) => {
            const d = decisions[i];
            const status =
              d.action === 'skip'
                ? { tone: 'neutral' as const, label: 'Ignorado', text: 'Não entra na compra' }
                : d.action === 'fuel'
                  ? { tone: 'info' as const, label: 'Combustível', text: FUEL_LABEL[d.fuel] }
                  : d.action === 'new'
                    ? { tone: 'info' as const, label: 'Novo', text: withPackage(d.name || 'Sem nome', d.packageSize, UNIT_INFO[d.unit].label) }
                    : {
                        tone: 'good' as const,
                        label: it.matchedBy === 'link' && it.decision.action === 'link' && it.decision.productId === d.productId ? 'Reconhecido' : 'Cadastrado',
                        text: productMap.get(d.productId)?.name ?? 'Escolha o produto',
                      };
            return (
              <button
                key={i}
                type="button"
                onClick={() => setEditing(i)}
                className={cx('flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-sunken', d.action === 'skip' && 'opacity-60')}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-3">
                    <span className="min-w-0 flex-1 break-words text-[13px] font-semibold uppercase tracking-wide text-muted">{it.item.description}</span>
                    <span className={cx('price tnum shrink-0 text-sm font-bold', d.action === 'skip' && 'line-through')}>{money(it.item.total)}</span>
                  </div>
                  <div className="tnum text-xs text-muted">
                    {qty(it.item.quantity)} {it.item.unit} × {money(it.item.unitPrice)}
                  </div>
                  <div className="mt-1.5 flex min-w-0 items-center gap-2">
                    <Chip tone={status.tone}>{status.label}</Chip>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{status.text}</span>
                    <Pencil className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
                  </div>
                </div>
              </button>
            );
          })}
        </Card>
      </Section>

      {editing !== null && (
        <Sheet open onClose={() => setEditing(null)} title="Item da nota" description={draft.items[editing].item.description}>
          {fuelMode ? (
            <SelectField
              label="Combustível"
              value={decisions[editing].action === 'fuel' ? (decisions[editing] as { fuel: FuelType }).fuel : ''}
              onChange={(e) => setFuel(editing, e.target.value ? { action: 'fuel', fuel: e.target.value as FuelType } : { action: 'skip' })}
            >
              <option value="">Ignorar este item</option>
              {FUEL_TYPES.map((f) => (
                <option key={f} value={f}>
                  {FUEL_LABEL[f]}
                </option>
              ))}
            </SelectField>
          ) : (
            <ItemControl
              decision={decisions[editing]}
              suggestion={draft.items[editing].decision}
              onChange={(nd) => setItem(editing, nd)}
              products={products ?? []}
              brands={brands}
              productName={(() => {
                const d = decisions[editing];
                return d.action === 'link' ? productMap.get(d.productId)?.name : undefined;
              })()}
            />
          )}
          <Button block className="mt-5" onClick={() => setEditing(null)}>
            Pronto
          </Button>
        </Sheet>
      )}

      <Button variant="ghost" className="self-start" onClick={onRestart}>
        Ler outra nota
      </Button>

      <div className="sticky bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom)+8px)] z-30 rounded-xl border border-line bg-surface/95 px-4 py-3 shadow-float backdrop-blur md:bottom-4">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs text-muted">
              {chosen} de {draft.items.length} {draft.items.length === 1 ? 'item' : 'itens'}
            </div>
            <div className="price tnum text-xl font-bold">{money(total)}</div>
          </div>
          <Button loading={saving} disabled={draft.alreadyImported || chosen === 0 || incomplete} onClick={save}>
            {fuelMode ? 'Salvar preços' : 'Salvar compra'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ItemControl({
  decision,
  suggestion,
  onChange,
  products,
  brands,
  productName,
}: {
  decision: ItemDecision;
  suggestion: ItemDecision;
  onChange: (d: ItemDecision) => void;
  products: Product[];
  brands: Map<ID, Brand>;
  productName?: string;
}) {
  const mode = decision.action === 'link' ? 'link' : decision.action === 'new' ? 'new' : 'skip';
  const fallbackNew: ItemDecision = suggestion.action === 'new' ? suggestion : { action: 'new', name: productName ?? '', unit: 'un', packageSize: 1 };
  return (
    <div className="flex flex-col gap-4">
      <Segmented<'link' | 'new' | 'skip'>
        label="Salvar como"
        value={mode}
        onChange={(v) => {
          if (v === 'skip') onChange({ action: 'skip' });
          else if (v === 'new') onChange(fallbackNew);
          else onChange(suggestion.action === 'link' ? suggestion : { action: 'link', productId: '' });
        }}
        options={[
          { value: 'link', label: 'Já cadastrado' },
          { value: 'new', label: 'Novo' },
          { value: 'skip', label: 'Ignorar' },
        ]}
      />
      {decision.action === 'new' && (
        <>
          <TextField label="Nome do produto" value={decision.name} onChange={(e) => onChange({ ...decision, name: e.target.value })} />
          <p className="-mt-2 text-xs text-muted">
            Embalagem: {decision.packageSize.toLocaleString('pt-BR')} {UNIT_INFO[decision.unit].label}. Dá para ajustar depois em Produtos.
          </p>
        </>
      )}
      {decision.action === 'link' && (
        <ProductPicker label="Produto" products={products} brands={brands} value={decision.productId || undefined} onChange={(id) => onChange({ action: 'link', productId: id })} />
      )}
      {decision.action === 'skip' && <p className="text-sm text-muted">Este item não entra na compra nem nos preços.</p>}
    </div>
  );
}
