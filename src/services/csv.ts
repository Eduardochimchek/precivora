export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | boolean | undefined | null;
}

/** Evita injeção de fórmulas ao abrir no Excel/Sheets. */
function cell(v: unknown): string {
  if (v == null) return '';
  let s = typeof v === 'number' ? v.toString().replace('.', ',') : String(v);
  if (/^[=+\-@\t\r]/.test(s) && typeof v !== 'number') s = `'${s}`;
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV com separador ";" e BOM (abre direto no Excel em português). */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [columns.map((c) => cell(c.header)).join(';')];
  for (const r of rows) lines.push(columns.map((c) => cell(c.value(r))).join(';'));
  return '﻿' + lines.join('\r\n');
}
