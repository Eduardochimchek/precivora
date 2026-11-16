const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brl3 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 3, maximumFractionDigits: 3 });
const num = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });
const pct = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 2 });

export const money = (v: number) => brl.format(Number.isFinite(v) ? v : 0);
/** Combustível costuma ter 3 casas decimais nas bombas. */
export const money3 = (v: number) => brl3.format(Number.isFinite(v) ? v : 0);
export const number = (v: number) => num.format(v);
export const percent = (v: number) => pct.format(v);
export const signedPercent = (v: number) => (v > 0 ? '+' : '') + pct.format(v);

/** Converte texto digitado ("23,90", "R$ 1.234,5") em número. */
export function parseDecimal(input: string): number {
  const s = String(input).replace(/[^\d,.-]/g, '');
  if (!s) return NaN;
  const hasComma = s.includes(',');
  const normalized = hasComma ? s.replace(/\./g, '').replace(',', '.') : s;
  return Number(normalized);
}

export function toInputDecimal(v: number | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return '';
  return v.toFixed(digits).replace('.', ',');
}
