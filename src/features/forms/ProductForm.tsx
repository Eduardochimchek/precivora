import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ImagePlus, Loader2, ScanBarcode, Search, Trash2 } from 'lucide-react';
import { isNative } from '@/app/native';
import { db } from '@/db/database';
import type { ID, Product, Unit } from '@/types';
import { UNITS } from '@/types';
import { Button, IconButton, SegmentIcon, SelectField, Sheet, TextField, TextareaField, cx, useFeedback } from '@/design-system';
import { useBrands, useCategories, useSegments } from '@/hooks/useData';
import { saveProduct } from '@/repositories/catalog';
import { UNIT_INFO, unitPrice, formatUnitPrice } from '@/services/units';
import { compressImage } from '@/utils/image';
import { isValidGtin, lookupBarcode, type ProductInfo } from '@/services/productLookup';
import { parseDecimal, toInputDecimal } from '@/utils/format';

export interface ProductFormProps {
  open: boolean;
  onClose: () => void;
  productId?: ID;
  initialName?: string;
  segmentId?: ID;
  onSaved?: (id: ID) => void;
}

type Notice = { tone: 'ok' | 'info' | 'warn'; text: string; existing?: Product; at: 'top' | 'field' };

const NOTICE_TONE: Record<Notice['tone'], string> = {
  ok: 'border-success/40 bg-success/10',
  info: 'border-line bg-sunken',
  warn: 'border-warn/50 bg-warn/10',
};

async function imageFromUrl(url: string): Promise<string | undefined> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return undefined;
    const blob = await res.blob();
    return await compressImage(new File([blob], 'produto', { type: blob.type || 'image/jpeg' }));
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

export function ProductForm({ open, onClose, productId, initialName, segmentId: initialSegment, onSaved }: ProductFormProps) {
  const { toast } = useFeedback();
  const brands = useBrands();
  const categories = useCategories();
  const segments = (useSegments() ?? []).filter((s) => s.mode === 'items');
  const [loaded, setLoaded] = useState<Product | null>(null);
  const [segmentId, setSegmentId] = useState<ID | ''>('');
  const [details, setDetails] = useState(false);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [unit, setUnit] = useState<Unit>('un');
  const [size, setSize] = useState('1');
  const [barcode, setBarcode] = useState('');
  const [image, setImage] = useState<string | undefined>();
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [looking, setLooking] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const session = useRef(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setNotice(null);
    setLooking(false);
    setPhotoLoading(false);
    session.current++;
    if (!productId) {
      setLoaded(null);
      setDetails(false);
      setSegmentId(initialSegment ?? '');
      setName(initialName ?? '');
      setBrand('');
      setCategoryId('');
      setSubcategory('');
      setUnit('un');
      setSize('1');
      setBarcode('');
      setImage(undefined);
      setDescription('');
      setNotes('');
      return;
    }
    void db.products.get(productId).then(async (p) => {
      if (!p) return;
      setLoaded(p);
      setSegmentId(p.segmentId ?? '');
      setDetails(!!(p.brandId || p.categoryId || p.barcode || p.description || p.notes || p.unit !== 'un' || p.packageSize !== 1));
      setName(p.name);
      setBrand(p.brandId ? ((await db.brands.get(p.brandId))?.name ?? '') : '');
      setCategoryId(p.categoryId ?? '');
      setSubcategory(p.subcategory ?? '');
      setUnit(p.unit);
      setSize(toInputDecimal(p.packageSize, 3).replace(/,?0+$/, '') || '1');
      setBarcode(p.barcode ?? '');
      setImage(p.image);
      setDescription(p.description ?? '');
      setNotes(p.notes ?? '');
    });
  }, [open, productId, initialName, initialSegment]);

  const packageSize = parseDecimal(size);

  function fill(info: ProductInfo) {
    if (info.name && (!name.trim() || name.trim() === (initialName ?? '').trim())) setName(info.name);
    if (info.brand && !brand.trim()) setBrand(info.brand);
    if (info.unit && info.packageSize && unit === 'un' && (parseDecimal(size) === 1 || !size.trim())) {
      setUnit(info.unit);
      setSize(toInputDecimal(info.packageSize, 3).replace(/,?0+$/, ''));
    }
  }

  async function applyBarcode(raw: string, at: Notice['at']) {
    const code = raw.replace(/\D/g, '');
    setBarcode(code);
    setNotice(null);
    setErrors(({ barcode: _, ...rest }) => rest);
    if (!isValidGtin(code)) {
      setDetails(true);
      setErrors((e) => ({ ...e, barcode: 'Código incompleto ou com número errado' }));
      return;
    }
    const existing = await db.products.where('barcode').equals(code).first();
    if (existing && existing.id !== productId) {
      setNotice({ tone: 'warn', text: `Este código já é do produto “${existing.name}”.`, existing, at });
      return;
    }
    setLooking(true);
    try {
      const info = await lookupBarcode(code);
      if (!info || (!info.name && !info.brand && !info.unit)) {
        setDetails(true);
        setNotice({ tone: 'info', text: 'Não achei este código na base pública de produtos. Preencha o nome; o código fica salvo para as próximas vezes.', at });
        return;
      }
      fill(info);
      setDetails(true);
      setNotice({ tone: 'ok', text: `Dados encontrados no ${info.source}. Confira antes de salvar.`, at });
      if (info.imageUrl && !image) {
        const run = session.current;
        setPhotoLoading(true);
        void imageFromUrl(info.imageUrl).then((img) => {
          if (run !== session.current) return;
          setPhotoLoading(false);
          if (img) setImage((cur) => cur ?? img);
        });
      }
    } catch {
      setDetails(true);
      setNotice({ tone: 'info', text: 'Sem internet para buscar os dados agora. O código foi preenchido; complete o resto à mão.', at });
    } finally {
      setLooking(false);
    }
  }

  async function scanBarcode(at: Notice['at']) {
    const { scanProductBarcode, ScanCancelled } = await import('@/app/nfceNative');
    try {
      await applyBarcode(await scanProductBarcode(), at);
    } catch (err) {
      if (!(err instanceof ScanCancelled)) toast((err as Error).message || 'Não foi possível ler o código', 'error');
    }
  }

  function openExisting(p: Product) {
    onClose();
    if (onSaved) onSaved(p.id);
    else navigate(`/produtos/${p.id}`);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Informe o nome do produto';
    if (!(packageSize > 0)) errs.size = 'Informe um número maior que zero';
    if (barcode && !/^\d{6,14}$/.test(barcode.replace(/\D/g, ''))) errs.barcode = 'Use de 6 a 14 dígitos';
    if (errs.size || errs.barcode) setDetails(true);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const id = await saveProduct(
        { name, segmentId: segmentId || undefined, brandName: brand, categoryId: categoryId || undefined, subcategory, unit, packageSize, barcode, image, description, notes },
        productId,
      );
      toast(productId ? 'Produto atualizado' : 'Produto cadastrado');
      onSaved?.(id);
      onClose();
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function pickImage(file?: File) {
    if (!file) return;
    try {
      setImage(await compressImage(file));
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  const noticeBox = notice && (
    <div className={cx('flex flex-col gap-2 rounded-lg border px-4 py-3 text-sm', NOTICE_TONE[notice.tone])} role="status">
      <p>{notice.text}</p>
      {notice.existing && (
        <Button size="sm" variant="secondary" className="self-start" onClick={() => openExisting(notice.existing!)}>
          {onSaved ? 'Usar este produto' : 'Abrir produto'}
        </Button>
      )}
    </div>
  );

  const example = packageSize > 0 ? formatUnitPrice(unitPrice(10, { unit, packageSize }), unit) : null;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={productId ? 'Editar produto' : 'Novo produto'}
      description={loaded?.archived ? 'Este produto está arquivado.' : undefined}
      dismissible={false}
      footer={
        <>
          <Button variant="secondary" block onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="product-form" block loading={saving}>
            {productId ? 'Salvar alterações' : 'Cadastrar produto'}
          </Button>
        </>
      }
    >
      <form id="product-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {isNative && !productId && (
          <button
            type="button"
            onClick={() => scanBarcode('top')}
            disabled={looking}
            className="flex items-center gap-3 rounded-lg border border-dashed border-accent/60 bg-accent/5 px-4 py-3 text-left hover:bg-accent/10 disabled:opacity-60"
          >
            <ScanBarcode className="h-6 w-6 shrink-0 text-accent" aria-hidden />
            <span>
              <span className="block text-[15px] font-semibold">{looking ? 'Buscando dados do produto…' : 'Ler código de barras'}</span>
              <span className="block text-xs text-muted">Preenche nome, marca, embalagem e foto quando o produto é conhecido</span>
            </span>
          </button>
        )}
        {notice?.at === 'top' && noticeBox}
        <TextField label="Nome" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} placeholder="Ex.: Arroz tipo 1, Dipirona 500 mg, Ração 10 kg" maxLength={120} data-autofocus />
        {segments.length > 0 && (
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">
              Onde costuma comprar <span className="font-normal text-muted">(opcional)</span>
            </legend>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Onde costuma comprar">
              {segments.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={segmentId === s.id}
                  onClick={() => setSegmentId(segmentId === s.id ? '' : s.id)}
                  className={cx(
                    'flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition-colors',
                    segmentId === s.id ? 'border-transparent bg-primary text-on-primary' : 'border-line text-muted hover:text-ink',
                  )}
                >
                  <SegmentIcon icon={s.icon} />
                  {s.name}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted">Ajuda a filtrar. O item pode ter preço em qualquer lugar.</p>
          </fieldset>
        )}
        <div>
          <span className="mb-1.5 block text-sm font-semibold">
            Foto <span className="font-normal text-muted">(opcional)</span>
          </span>
          <div className="flex items-center gap-3">
            {image ? (
              <img src={image} alt="Foto do produto" className="h-20 w-20 rounded-lg object-cover" />
            ) : photoLoading ? (
              <div className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg bg-sunken text-[11px] text-muted" role="status">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                Baixando
              </div>
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-sunken text-muted">
                <ImagePlus className="h-6 w-6" aria-hidden />
              </div>
            )}
            <label className="inline-flex h-10 cursor-pointer items-center rounded-md border border-line px-3 text-sm font-semibold hover:bg-sunken focus-within:ring-2 focus-within:ring-accent">
              {image ? 'Trocar foto' : 'Escolher foto'}
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => pickImage(e.target.files?.[0])} />
            </label>
            {image && (
              <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => setImage(undefined)}>
                Remover
              </Button>
            )}
          </div>
        </div>

        <button
          type="button"
          aria-expanded={details}
          aria-controls="product-details"
          onClick={() => setDetails((d) => !d)}
          className="flex items-center justify-between rounded-lg border border-line px-4 py-3 text-left hover:bg-sunken"
        >
          <span>
            <span className="block text-[15px] font-semibold">Mais detalhes</span>
            <span className="block text-xs text-muted">Marca, categoria, embalagem (para comparar por kg ou litro), código de barras</span>
          </span>
          <ChevronDown className={cx('h-5 w-5 shrink-0 text-muted transition-transform', details && 'rotate-180')} aria-hidden />
        </button>

        {details && (
          <div id="product-details" className="flex animate-fade-in flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Marca" optional value={brand} onChange={(e) => setBrand(e.target.value)} list="brand-options" maxLength={80} />
              <datalist id="brand-options">{brands?.map((b) => <option key={b.id} value={b.name} />)}</datalist>
              <SelectField label="Categoria" optional value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Sem categoria</option>
                {(categories ?? []).filter((c) => !segmentId || !c.segmentId || c.segmentId === segmentId).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </SelectField>
            </div>
            <TextField label="Subcategoria" optional value={subcategory} onChange={(e) => setSubcategory(e.target.value)} maxLength={60} />
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Conteúdo da embalagem"
                inputMode="decimal"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                error={errors.size}
                suffix={UNIT_INFO[unit].label}
              />
              <SelectField label="Unidade" value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {UNIT_INFO[u].name}
                  </option>
                ))}
              </SelectField>
            </div>
            {example && <p className="-mt-2 text-xs text-muted">Usado para comparar por unidade. Ex.: R$ 10,00 nesta embalagem = {example}.</p>}
            <div className="flex items-start gap-2">
              <TextField
                label="Código de barras"
                optional
                inputMode="numeric"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value.replace(/\D/g, '').slice(0, 14))}
                error={errors.barcode}
                placeholder="EAN de 8 ou 13 dígitos"
                wrapperClassName="min-w-0 flex-1"
              />
              <div className="mt-[26px] flex shrink-0 gap-1">
                {isNative && (
                  <IconButton label="Ler código de barras" onClick={() => scanBarcode('field')} disabled={looking} className="h-12 w-12 border border-line">
                    <ScanBarcode className="h-5 w-5" aria-hidden />
                  </IconButton>
                )}
                <Button variant="secondary" className="h-12" icon={<Search className="h-4 w-4" />} loading={looking} disabled={barcode.length < 8} onClick={() => applyBarcode(barcode, 'field')}>
                  Buscar
                </Button>
              </div>
            </div>
            {notice?.at === 'field' && noticeBox}
            <TextareaField label="Descrição" optional value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} />
            <TextareaField label="Observações" optional value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
          </div>
        )}
        {!details && <p className="-mt-2 text-xs text-muted">Sem detalhes, o item conta como 1 unidade. Você pode completar depois.</p>}
      </form>
    </Sheet>
  );
}
