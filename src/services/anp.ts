import type { FuelType } from '@/types';
import { searchKey } from '@/utils/text';

/** Levantamento de preços da ANP: coletas nos postos das últimas quatro semanas (atualizado toda semana). */
export const ANP_URLS = [
  'https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/arquivos/shpc/qus/ultimas-4-semanas-gasolina-etanol.csv',
  'https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/arquivos/shpc/qus/ultimas-4-semanas-diesel-gnv.csv',
];

export const ANP_NOTE_PREFIX = 'ANP';

export interface AnpRow {
  uf: string;
  city: string;
  name: string;
  cnpj: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  fuel: FuelType;
  /** Meio-dia de Brasília do dia da coleta, em ISO. */
  date: string;
  price: number;
  flag?: string;
}

const PRODUCTS: Record<string, FuelType> = {
  GASOLINA: 'gasolina_comum',
  'GASOLINA ADITIVADA': 'gasolina_aditivada',
  ETANOL: 'etanol',
  DIESEL: 'diesel',
  'DIESEL S10': 'diesel_s10',
  GNV: 'gnv',
};

const FLAGS: Record<string, string> = {
  IPIRANGA: 'Ipiranga',
  RAIZEN: 'Shell',
  'RAIZEN MIME': 'Shell',
  VIBRA: 'Petrobras',
  'VIBRA ENERGIA': 'Petrobras',
  PETROBRAS: 'Petrobras',
  'PETROBRAS DISTRIBUIDORA S.A.': 'Petrobras',
  ALESAT: 'Ale',
  ALE: 'Ale',
  BRANCA: 'Bandeira branca',
};

const COLUMNS = {
  uf: 'estado - sigla',
  city: 'municipio',
  name: 'revenda',
  cnpj: 'cnpj da revenda',
  street: 'nome da rua',
  number: 'numero rua',
  complement: 'complemento',
  neighborhood: 'bairro',
  product: 'produto',
  date: 'data da coleta',
  price: 'valor de venda',
  flag: 'bandeira',
} as const;

export const cityKey = (city: string | undefined) => searchKey(city ?? '');

const titleCase = (s: string) =>
  s
    .toLowerCase()
    .replace(/(^|[\s/(.-])([a-zà-ú])/g, (_, a: string, b: string) => a + b.toUpperCase())
    .replace(/\b(De|Da|Do|Das|Dos|E)\b/g, (w, _1, i: number) => (i === 0 ? w : w.toLowerCase()));

export function anpFlag(raw: string): string | undefined {
  const k = raw.trim().toUpperCase();
  if (!k) return undefined;
  return FLAGS[k] ?? titleCase(k);
}

/** Nome do posto a partir da razão social da ANP ("AUTO POSTO X LTDA" → "Auto Posto X"). */
export function anpStationName(raw: string): string {
  const s = raw
    .replace(/\b(LTDA|EIRELI|EPP|ME|S\/?A|S\.A\.?)\b\.?/gi, '')
    .replace(/\bEM RECUPERACAO JUDICIAL\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\s,.&-]+$/, '');
  return titleCase(s).slice(0, 100) || 'Posto';
}

/** Lê os CSVs do levantamento (separados por ";"). Linhas de outros produtos ou inválidas são ignoradas. */
export function parseAnpCsv(text: string): AnpRow[] {
  const lines = text.replace(/^(\uFEFF|\u00EF\u00BB\u00BF)/, '').split(/\r?\n/);
  const header = (lines.shift() ?? '').split(';').map((h) => searchKey(h).replace(/\s+/g, ' '));
  const idx = Object.fromEntries(Object.entries(COLUMNS).map(([k, name]) => [k, header.indexOf(name)])) as Record<keyof typeof COLUMNS, number>;
  if (Object.values(idx).some((i) => i < 0)) throw new Error('O arquivo da ANP mudou de formato.');
  const out: AnpRow[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const c = line.split(';');
    const fuel = PRODUCTS[(c[idx.product] ?? '').trim().toUpperCase()];
    const cnpj = (c[idx.cnpj] ?? '').replace(/\D/g, '');
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((c[idx.date] ?? '').trim());
    const price = Number((c[idx.price] ?? '').trim().replace(/\./g, '').replace(',', '.'));
    if (!fuel || cnpj.length !== 14 || !m || !(price > 0 && price < 100)) continue;
    out.push({
      uf: (c[idx.uf] ?? '').trim().toUpperCase(),
      city: (c[idx.city] ?? '').trim(),
      name: (c[idx.name] ?? '').trim(),
      cnpj,
      street: (c[idx.street] ?? '').trim(),
      number: (c[idx.number] ?? '').trim(),
      complement: (c[idx.complement] ?? '').trim(),
      neighborhood: (c[idx.neighborhood] ?? '').trim(),
      fuel,
      date: `${m[3]}-${m[2]}-${m[1]}T15:00:00.000Z`,
      price,
      flag: anpFlag(c[idx.flag] ?? ''),
    });
  }
  return out;
}

export const anpNote = (date: string) => `${ANP_NOTE_PREFIX} – levantamento de preços (coleta em ${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)})`;

export const anpAddress = (r: Pick<AnpRow, 'street' | 'number' | 'complement'>) =>
  [titleCase(r.street) + (r.number ? `, ${r.number}` : ''), r.complement ? titleCase(r.complement) : ''].filter(Boolean).join(' - ').slice(0, 200);

export const anpTitle = titleCase;
