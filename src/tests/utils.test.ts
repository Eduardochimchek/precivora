import { parseDecimal, money } from '@/utils/format';
import { cleanText, matches, searchKey } from '@/utils/text';
import { fromDateInput, isStale, toDateInput, daysBetween } from '@/utils/date';
import { toCsv } from '@/services/csv';

describe('parseDecimal', () => {
  it('entende vírgula decimal e milhar com ponto', () => {
    expect(parseDecimal('23,90')).toBe(23.9);
    expect(parseDecimal('R$ 1.234,56')).toBe(1234.56);
    expect(parseDecimal('5.5')).toBe(5.5);
    expect(parseDecimal('')).toBeNaN();
    expect(parseDecimal('abc')).toBeNaN();
  });
  it('money formata em reais', () => {
    expect(money(23.9).replace(/\s/g, ' ')).toBe('R$ 23,90');
  });
});

describe('texto', () => {
  it('searchKey remove acentos e caixa', () => {
    expect(searchKey('  Feijão   Preto ')).toBe('feijao preto');
  });
  it('matches ignora acentos e aceita termos em qualquer ordem', () => {
    expect(matches('Açúcar Refinado União', 'uniao acucar')).toBe(true);
    expect(matches('Arroz', 'feijão')).toBe(false);
    expect(matches('Arroz', '')).toBe(true);
  });
  it('cleanText remove controle, apara e limita', () => {
    expect(cleanText('  a\u0000b  ')).toBe('ab');
    expect(cleanText('   ')).toBeUndefined();
    expect(cleanText('abcdef', 3)).toBe('abc');
    expect(cleanText(undefined)).toBeUndefined();
  });
});

describe('datas', () => {
  it('fromDateInput mantém o dia no fuso local', () => {
    const iso = fromDateInput('2026-03-01');
    expect(toDateInput(iso)).toBe('2026-03-01');
    expect(new Date(iso).getDate()).toBe(1);
  });
  it('isStale compara com o limite de dias', () => {
    const now = new Date('2026-11-16T12:00:00Z');
    expect(isStale('2026-11-01T12:00:00Z', 30, now)).toBe(false);
    expect(isStale('2026-10-01T12:00:00Z', 30, now)).toBe(true);
    expect(daysBetween('2026-11-10T12:00:00Z', now)).toBe(6);
  });
});

describe('csv', () => {
  const rows = [{ a: 'Arroz "tipo 1"', b: 1.5, c: '=SUM(A1)' }, { a: 'x;y', b: 2, c: '-10' }];
  const out = toCsv(rows, [
    { header: 'Nome', value: (r) => r.a },
    { header: 'Valor', value: (r) => r.b },
    { header: 'Obs', value: (r) => r.c },
  ]);
  it('usa BOM e separador ;', () => {
    expect(out.startsWith('﻿')).toBe(true);
    expect(out.split('\r\n')[0]).toBe('﻿Nome;Valor;Obs');
  });
  it('escapa aspas, protege fórmulas e usa vírgula decimal', () => {
    const lines = out.split('\r\n');
    expect(lines[1]).toBe(`"Arroz ""tipo 1""";1,5;'=SUM(A1)`);
    expect(lines[2]).toBe(`"x;y";2;'-10`);
  });
});

describe('números digitados e mensagens de validação', () => {
  it('recusa letras no número, mas aceita o R$ na frente', async () => {
    const { parseDecimal } = await import('@/utils/format');
    expect(parseDecimal('1e3')).toBeNaN();
    expect(parseDecimal('12abc')).toBeNaN();
    expect(parseDecimal('R$ 1.234,56')).toBe(1234.56);
    expect(parseDecimal(' 7,90 ')).toBe(7.9);
  });

  it('mostra o problema em português com o nome do campo', async () => {
    const { productSchema, priceSchema, firstIssue } = await import('@/services/schemas');
    const big = productSchema.safeParse({ id: 'a', name: 'X', nameKey: 'x', unit: 'kg', packageSize: 999999999, archived: false, createdAt: '2026-01-01', updatedAt: '2026-01-01' });
    expect(!big.success && firstIssue(big.error)).toBe('Conteúdo da embalagem: o máximo é 100.000');
    const long = productSchema.safeParse({ id: 'a', name: 'X'.repeat(200), nameKey: 'x', unit: 'kg', packageSize: 1, archived: false, createdAt: '2026-01-01', updatedAt: '2026-01-01' });
    expect(!long.success && firstIssue(long.error)).toBe('Nome: no máximo 120 caracteres');
    const zero = priceSchema.safeParse({ id: 'a', productId: 'b', storeId: 'c', price: 0, quantity: 1, date: '2026-01-01', promo: false, source: 'manual', createdAt: '2026-01-01', updatedAt: '2026-01-01' });
    expect(!zero.success && firstIssue(zero.error)).toMatch(/^Preço/);
  });
});
