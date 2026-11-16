const DAY = 86_400_000;

export const nowISO = () => new Date().toISOString();

export function daysBetween(a: string | Date, b: string | Date = new Date()): number {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / DAY);
}

export function isStale(date: string, staleDays: number, now: Date = new Date()): boolean {
  return daysBetween(date, now) > staleDays;
}

const dFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const dShort = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });
const dtFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
const mShort = new Intl.DateTimeFormat('pt-BR', { month: 'short' });
const mLong = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });

export const formatDate = (iso: string) => dFmt.format(new Date(iso));
export const formatShort = (iso: string) => dShort.format(new Date(iso)).replace('.', '');
export const formatDateTime = (iso: string) => dtFmt.format(new Date(iso));
/** "nov/26" */
export const formatMonth = (iso: string) => {
  const d = new Date(iso);
  return `${mShort.format(d).replace('.', '')}/${String(d.getFullYear()).slice(2)}`;
};
export const formatMonthLong = (d: Date) => mLong.format(d);

export function relativeDays(iso: string, now: Date = new Date()): string {
  const d = daysBetween(iso, now);
  if (d <= 0) return 'hoje';
  if (d === 1) return 'ontem';
  if (d < 30) return `há ${d} dias`;
  const m = Math.floor(d / 30);
  if (m < 12) return m === 1 ? 'há 1 mês' : `há ${m} meses`;
  const y = Math.floor(d / 365);
  return y <= 1 ? 'há 1 ano' : `há ${y} anos`;
}

/** "YYYY-MM" no fuso local. */
export function monthKey(iso: string | Date): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function startOfMonth(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Valor para <input type="date"> no fuso local. */
export function toDateInput(iso: string | Date = new Date()): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function toDateTimeInput(iso: string | Date = new Date()): string {
  const d = new Date(iso);
  return `${toDateInput(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Interpreta "YYYY-MM-DD" como meio-dia local (evita virar o dia por fuso). */
export function fromDateInput(v: string): string {
  const [y, m, d] = v.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).toISOString();
}

export function fromDateTimeInput(v: string): string {
  return new Date(v).toISOString();
}

export function greeting(d: Date = new Date()): string {
  const h = d.getHours();
  if (h < 5) return 'Boa noite';
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}
