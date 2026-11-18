/** Semelhança entre descrições de produto (nota fiscal abreviada × nome cadastrado). */

const ABBREV: Record<string, string> = {
  arr: 'arroz', feij: 'feijao', fei: 'feijao', refrig: 'refrigerante', refri: 'refrigerante', ref: 'refrigerante', choc: 'chocolate',
  achoc: 'achocolatado', bisc: 'biscoito', biscr: 'biscoito', bisct: 'biscoito', bol: 'bolacha', macarr: 'macarrao', mac: 'macarrao',
  marg: 'margarina', manteig: 'manteiga', mant: 'manteiga', farin: 'farinha', far: 'farinha', trig: 'trigo', deterg: 'detergente',
  det: 'detergente', desinf: 'desinfetante', amac: 'amaciante', sabon: 'sabonete', sabt: 'sabonete', pap: 'papel',
  hig: 'higienico', cr: 'creme', dent: 'dental', shamp: 'shampoo', sh: 'shampoo', iog: 'iogurte', iogur: 'iogurte',
  quei: 'queijo', qjo: 'queijo', qj: 'queijo', pres: 'presunto', mort: 'mortadela', linguic: 'linguica', ling: 'linguica', salsic: 'salsicha',
  frang: 'frango', fgo: 'frango', fil: 'file', bov: 'bovina', sui: 'suina', cx: 'caixa', pct: 'pacote', integ: 'integral', int: 'integral',
  desn: 'desnatado', semidesn: 'semidesnatado', trad: 'tradicional', tp: 'tipo', ext: 'extra', az: 'azeite', azeit: 'azeite', ol: 'oleo',
  veg: 'vegetal', tom: 'tomate', ext_tom: 'extrato', molh: 'molho', maion: 'maionese', cat: 'catchup', ketc: 'ketchup', cafe: 'cafe',
  caf: 'cafe', acuc: 'acucar', acu: 'acucar', refin: 'refinado', crist: 'cristal', sal: 'sal', leit: 'leite', lt: 'leite', ovo: 'ovos',
  agua: 'agua', ag: 'agua', min: 'mineral', gas: 'gaseificada', cerv: 'cerveja', suc: 'suco', nect: 'nectar', pao: 'pao', bisn: 'bisnaguinha',
  esp: 'esponja', limp: 'limpador', multiuso: 'multiuso', alv: 'alvejante', agsanit: 'agua sanitaria', sanit: 'sanitaria',
  fral: 'fralda', abs: 'absorvente', desod: 'desodorante', aer: 'aerosol', rol: 'roll', past: 'pasta', gel: 'gel',
};

const STOP = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'c', 'com', 'p', 'para', 'un', 'und', 'unid', 'kg', 'g', 'gr', 'l', 'ml', 'lt', 'pc', 'pct', 'cx', 'fd', 'sc', 'emb', 'a', 'o']);

const UNIT_BASE: Record<string, [string, number]> = {
  kg: ['g', 1000], g: ['g', 1], gr: ['g', 1], grs: ['g', 1], l: ['ml', 1000], lt: ['ml', 1000], lts: ['ml', 1000], ml: ['ml', 1], cl: ['ml', 10],
};

export interface MatchKey {
  tokens: string[];
  size?: { unit: string; amount: number };
}

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Tokens normalizados e tamanho da embalagem ("5KG" → 5000 g). */
export function matchKey(text: string): MatchKey {
  let s = fold(text).replace(/(\d),(\d)/g, '$1.$2');
  let size: MatchKey['size'];
  const m = /(\d+(?:\.\d+)?)\s*(kg|grs|gr|g|lts|lt|l|ml|cl)\b/.exec(s);
  if (m) {
    const [unit, f] = UNIT_BASE[m[2]];
    size = { unit, amount: Math.round(Number(m[1]) * f) };
    s = s.replace(m[0], ' ');
  }
  s = s.replace(/\bt\s?([123])\b/g, 'tipo $1').replace(/\btp\s?([123])\b/g, 'tipo $1');
  const tokens: string[] = [];
  for (let raw of s.split(/[^a-z0-9]+/)) {
    if (!raw) continue;
    raw = ABBREV[raw] ?? raw;
    for (const t of raw.split(' ')) if (t && !STOP.has(t) && !/^\d+x$/.test(t)) tokens.push(t);
  }
  return { tokens: [...new Set(tokens)], size };
}

const tokenEq = (a: string, b: string) => a === b || (a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a)));

/** 0 a 1. Embalagens de tamanhos diferentes nunca são o mesmo produto. */
export function similarity(a: MatchKey, b: MatchKey): number {
  if (a.size && b.size && (a.size.unit !== b.size.unit || Math.abs(a.size.amount - b.size.amount) > Math.max(a.size.amount, b.size.amount) * 0.02)) return 0;
  if (!a.tokens.length || !b.tokens.length) return 0;
  const used = new Set<number>();
  let hits = 0;
  for (const t of a.tokens) {
    const j = b.tokens.findIndex((u, k) => !used.has(k) && tokenEq(t, u));
    if (j >= 0) {
      used.add(j);
      hits++;
    }
  }
  const dice = (2 * hits) / (a.tokens.length + b.tokens.length);
  const sizeBonus = a.size && b.size ? 0.1 : 0;
  const numsA = a.tokens.filter((t) => /^\d+$/.test(t));
  const numsB = b.tokens.filter((t) => /^\d+$/.test(t));
  const numMismatch = numsA.length > 0 && numsB.length > 0 && (numsA.some((t) => !numsB.includes(t)) || numsB.some((t) => !numsA.includes(t)));
  return Math.max(0, Math.min(1, dice + sizeBonus - (numMismatch ? 0.25 : 0)));
}

export interface MatchCandidate {
  id: string;
  /** Nome + marca do produto e descrições de notas já ligadas a ele. */
  texts: string[];
}

export function bestMatch(description: string, candidates: MatchCandidate[]): { id: string; score: number } | undefined {
  const key = matchKey(description);
  let best: { id: string; score: number } | undefined;
  for (const c of candidates) {
    for (const t of c.texts) {
      const score = similarity(key, matchKey(t));
      if (!best || score > best.score) best = { id: c.id, score };
    }
  }
  return best && best.score > 0 ? best : undefined;
}

export const STRONG_MATCH = 0.78;
export const WEAK_MATCH = 0.5;
