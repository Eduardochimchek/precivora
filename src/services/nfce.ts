import type { FuelType, Unit } from '@/types';

/** Item como aparece na consulta pública da NFC-e. */
export interface ReceiptItem {
  description: string;
  code?: string;
  quantity: number;
  /** Unidade comercial da nota (UN, KG, L, PCT...). */
  unit: string;
  unitPrice: number;
  total: number;
}

export interface Receipt {
  accessKey?: string;
  number?: string;
  issuedAt?: string;
  store: {
    name: string;
    cnpj?: string;
    address?: string;
    neighborhood?: string;
    city?: string;
  };
  items: ReceiptItem[];
  total?: number;
}

export class ReceiptParseError extends Error {}

const UF_CONSULTA: Record<string, string> = {
  '42': 'https://sat.sef.sc.gov.br/nfce/consulta',
};

/** Número no formato brasileiro ("1.234,56") para number. */
export function parseBrNumber(v: string | undefined | null): number {
  if (!v) return NaN;
  const s = v.replace(/[^\d,.-]/g, '');
  if (!s) return NaN;
  return Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
}

const squash = (s: string | null | undefined) => (s ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();

/** Extrai a chave de acesso (44 dígitos) de um QR Code, link ou texto digitado. */
export function extractAccessKey(input: string): string | undefined {
  const fromP = /[?&](?:p|chNFe)=([0-9]{44})/i.exec(input);
  if (fromP) return fromP[1];
  const digits = input.replace(/\D/g, '');
  if (digits.length === 44) return digits;
  const loose = /(?:\d[\s.]?){44}/.exec(input);
  return loose ? loose[0].replace(/\D/g, '') : undefined;
}

export const ufOfKey = (key: string) => key.slice(0, 2);

const NOT_RECEIPT_QR = 'Este QR Code não é de nota fiscal. Aponte para o QR Code impresso no cupom (NFC-e).';

/** Link de consulta de uma Secretaria da Fazenda (domínio .gov.br). */
export function isFazendaUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (u.protocol === 'https:' || u.protocol === 'http:') && /\.gov\.br$/i.test(u.hostname) && !u.username && !u.password;
  } catch {
    return false;
  }
}

/**
 * Endereço para abrir a nota: o próprio link do QR Code (quando é um link da Fazenda)
 * ou, para a chave digitada, a página de consulta do estado.
 */
export function consultationUrl(input: string): { url: string; key?: string; needsKeyTyping: boolean } {
  const trimmed = input.trim();
  const key = extractAccessKey(trimmed);
  if (/^https?:\/\//i.test(trimmed)) {
    if (!isFazendaUrl(trimmed) || !key) throw new ReceiptParseError(NOT_RECEIPT_QR);
    return { url: trimmed.replace(/^http:/i, 'https:'), key, needsKeyTyping: false };
  }
  if (!key) throw new ReceiptParseError(/^[a-z]+:/i.test(trimmed) ? NOT_RECEIPT_QR : 'Não encontrei uma chave de acesso válida (44 números).');
  const base = UF_CONSULTA[ufOfKey(key)];
  if (!base) throw new ReceiptParseError('Por enquanto só notas de Santa Catarina podem ser consultadas pela chave. Escaneie o QR Code do cupom.');
  return { url: base, key, needsKeyTyping: true };
}

const titleCase = (s: string) =>
  s
    .toLowerCase()
    .replace(/(^|[\s/(-])([a-zà-ú])/g, (_, a: string, b: string) => a + b.toUpperCase())
    .replace(/\b(\d+(?:[.,]\d+)?)\s?(Kg|G|Gr|L|Lt|Ml|Un)\b/gi, (_, n: string, u: string) => {
      const unit = u.toLowerCase();
      return n + (unit === 'l' || unit === 'lt' ? 'L' : unit === 'gr' ? 'g' : unit);
    });

function splitAddress(raw: string): Pick<Receipt['store'], 'address' | 'neighborhood' | 'city'> {
  const parts = raw
    .split(',')
    .map((p) => squash(p))
    .filter(Boolean);
  if (parts.length && /^[A-Z]{2}$/.test(parts[parts.length - 1])) parts.pop();
  if (parts.length < 3) return { address: titleCase(parts.join(', ')) || undefined };
  const city = parts.pop()!;
  const neighborhood = parts.pop()!;
  return { address: titleCase(parts.join(', ')), neighborhood: titleCase(neighborhood), city: titleCase(city) };
}

function issuedAtFrom(text: string): string | undefined {
  const m = /Emiss[ãa]o:\s*(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/i.exec(text);
  if (!m) return undefined;
  const [, d, mo, y, h = '12', mi = '00', s = '00'] = m;
  return new Date(+y, +mo - 1, +d, +h, +mi, +s).toISOString();
}

function itemsFromDom(doc: Document): ReceiptItem[] {
  const rows = [...doc.querySelectorAll('tr')].filter((tr) => tr.querySelector('.RvlUnit'));
  return rows.flatMap((tr) => {
    const description = squash(tr.querySelector('.txtTit')?.textContent);
    const code = /C[óo]digo:\s*([^)]*)\)/i.exec(tr.querySelector('.RCod')?.textContent ?? '')?.[1];
    const quantity = parseBrNumber(tr.querySelector('.Rqtd')?.textContent?.replace(/Qtde\.?:/i, ''));
    const unit = squash(tr.querySelector('.RUN')?.textContent?.replace(/UN:/i, ''));
    const unitPrice = parseBrNumber(tr.querySelector('.RvlUnit')?.textContent?.replace(/Vl\.?\s*Unit\.?:/i, ''));
    const total = parseBrNumber(tr.querySelector('.valor')?.textContent);
    if (!description || !(quantity > 0) || !(unitPrice >= 0)) return [];
    return [{ description, code: squash(code) || undefined, quantity, unit: unit.toUpperCase() || 'UN', unitPrice, total: total > 0 ? total : Math.round(quantity * unitPrice * 100) / 100 }];
  });
}

const ITEM_TEXT =
  /([^]*?)\(\s*C[óo]digo:\s*([^)]*?)\s*\)\s*Qtde\.?:\s*([\d.,]+)\s*UN:\s*([A-Za-z0-9]+)\s*Vl\.?\s*Unit\.?:\s*([\d.,]+)\s*(?:Vl\.?\s*Total\s*)?([\d.,]+)/gi;

function itemsFromText(text: string): ReceiptItem[] {
  const out: ReceiptItem[] = [];
  const start = text.search(/C[óo]digo:/i);
  if (start < 0) return out;
  const header = text.lastIndexOf(', SC', start);
  const body = header >= 0 ? text.slice(header + 4) : text;
  for (const m of body.matchAll(ITEM_TEXT)) {
    const description = squash(m[1].replace(/^.*\bVl\.?\s*Total\b/i, ''));
    const quantity = parseBrNumber(m[3]);
    const unitPrice = parseBrNumber(m[5]);
    const total = parseBrNumber(m[6]);
    if (!description || !(quantity > 0)) continue;
    out.push({ description, code: squash(m[2]) || undefined, quantity, unit: m[4].toUpperCase(), unitPrice, total });
  }
  return out;
}

/** Lê a página de consulta pública da NFC-e (layout nacional, usado por SC e outros estados). */
export function parseReceiptHtml(html: string): Receipt {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const text = squash(doc.body?.textContent);
  if (!/Vl\.?\s*Unit/i.test(text)) {
    if (/valida[çc][ãa]o de seguran[çc]a/i.test(text)) throw new ReceiptParseError('A Fazenda ainda está pedindo a verificação de segurança.');
    throw new ReceiptParseError('Esta página não parece ser uma nota fiscal de consumidor.');
  }

  let items = itemsFromDom(doc);
  if (!items.length) items = itemsFromText(text);
  if (!items.length) throw new ReceiptParseError('Não consegui ler os itens desta nota.');

  const name = squash(doc.querySelector('#u20, .txtTopo')?.textContent);
  const cnpj = /CNPJ:?\s*([\d./-]{14,18})/i.exec(text)?.[1].replace(/\D/g, '');
  const textDivs = [...doc.querySelectorAll('.txtCenter .text, div.text')].map((d) => squash(d.textContent));
  const addressRaw = textDivs.find((t) => !/CNPJ/i.test(t) && /,/.test(t));
  const keyMatch = /Chave de acesso:?\s*((?:\d\s?){44})/i.exec(text) ?? /((?:\d{4}\s){10}\d{4})/.exec(text);
  const total = parseBrNumber(/Valor a pagar R\$:?\s*([\d.,]+)/i.exec(text)?.[1]);

  return {
    accessKey: keyMatch ? keyMatch[1].replace(/\D/g, '') : undefined,
    number: /N[úu]mero:\s*(\d+)/i.exec(text)?.[1],
    issuedAt: issuedAtFrom(text),
    store: { name: titleCase(name || 'Estabelecimento'), cnpj: cnpj?.length === 14 ? cnpj : undefined, ...(addressRaw ? splitAddress(addressRaw) : {}) },
    items,
    total: total > 0 ? total : Math.round(items.reduce((s, i) => s + i.total, 0) * 100) / 100,
  };
}

/** Nome de produto mais legível a partir da descrição abreviada da nota. */
export const prettyItemName = (description: string) =>
  titleCase(squash(description).replace(/\s+(KG|UN|UND|UNID|PCT|PC|CX|LT|L)\.?$/i, '')).slice(0, 100);

/** Chave de busca da descrição: sem acentos, maiúsculas, espaços únicos. */
export const descriptionKey = (description: string) =>
  squash(description)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

const UNIT_ALIASES: Record<string, Unit> = { KG: 'kg', G: 'g', GR: 'g', L: 'L', LT: 'L', ML: 'ml', DZ: 'dz', PCT: 'pct', PC: 'un', CX: 'cx' };

/** Embalagem sugerida para um item novo: vendido a granel (KG/L) ou tamanho escrito na descrição ("5KG", "2L"). */
export function guessPackage(item: Pick<ReceiptItem, 'description' | 'unit'>): { unit: Unit; packageSize: number } {
  const byUnit = UNIT_ALIASES[item.unit.toUpperCase()];
  if (byUnit === 'kg' || byUnit === 'L' || byUnit === 'g' || byUnit === 'ml') return { unit: byUnit, packageSize: 1 };
  const m = /(\d+(?:[.,]\d+)?)\s?(KG|GR|G|LT|L|ML)\b/i.exec(item.description);
  if (m) {
    const size = parseBrNumber(m[1]);
    const unit = UNIT_ALIASES[m[2].toUpperCase()];
    if (size > 0 && unit) return { unit, packageSize: size };
  }
  return { unit: byUnit === 'dz' || byUnit === 'pct' || byUnit === 'cx' ? byUnit : 'un', packageSize: 1 };
}

/** Combustível pela descrição do item da nota do posto. */
export function fuelFromDescription(description: string): FuelType | undefined {
  const d = descriptionKey(description);
  if (/\bGNV\b|GAS NATURAL/.test(d)) return 'gnv';
  if (/DIESEL/.test(d)) return /S-?10\b/.test(d) ? 'diesel_s10' : 'diesel';
  if (/ETANOL|ALCOOL/.test(d)) return 'etanol';
  if (/GASOLINA|\bGAS\b/.test(d)) {
    if (/PREMIUM|PODIUM|V-?POWER|OCTAPRO/.test(d)) return 'gasolina_premium';
    if (/ADITIV|GRID|SUPRA|EVOLUX|DT CLEAN/.test(d)) return 'gasolina_aditivada';
    return 'gasolina_comum';
  }
  return undefined;
}
