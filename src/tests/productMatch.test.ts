import { describe, expect, it } from 'vitest';
import { bestMatch, matchKey, similarity, STRONG_MATCH, WEAK_MATCH } from '@/services/productMatch';

const sim = (a: string, b: string) => similarity(matchKey(a), matchKey(b));

describe('semelhança de produtos entre notas', () => {
  it('normaliza abreviações e tamanho', () => {
    expect(matchKey('ARR TIO JOAO T1 5KG')).toEqual({ tokens: ['arroz', 'tio', 'joao', 'tipo', '1'], size: { unit: 'g', amount: 5000 } });
    expect(matchKey('REFRIG COCA COLA 2L').size).toEqual({ unit: 'ml', amount: 2000 });
    expect(matchKey('LEITE INTEG 1,5L').size).toEqual({ unit: 'ml', amount: 1500 });
  });

  it('reconhece o mesmo produto escrito por mercados diferentes', () => {
    expect(sim('ARROZ TIO JOAO TIPO 1 5KG', 'ARR TIO JOAO T1 5 KG')).toBeGreaterThanOrEqual(STRONG_MATCH);
    expect(sim('REFRIG COCA COLA PET 2L', 'Refrigerante Coca-Cola 2 L')).toBeGreaterThanOrEqual(STRONG_MATCH);
    expect(sim('FEIJ PRETO CALDAO 1KG', 'Feijão Preto Caldão 1kg')).toBeGreaterThanOrEqual(STRONG_MATCH);
    expect(sim('ARR TIO JOAO T1 5KG', 'Arroz Tio João 5kg')).toBeGreaterThanOrEqual(STRONG_MATCH);
    expect(sim('LT COND MOCA 395G', 'Leite Condensado Moça 395g')).toBeGreaterThanOrEqual(STRONG_MATCH);
  });

  it('não junta tamanhos ou tipos diferentes', () => {
    expect(sim('ARROZ TIO JOAO T1 5KG', 'ARROZ TIO JOAO T1 1KG')).toBe(0);
    expect(sim('ARROZ TIO JOAO T1 5KG', 'ARROZ TIO JOAO T2 5KG')).toBeLessThan(STRONG_MATCH);
    expect(sim('LEITE INTEG TIROL 1L', 'LEITE DESN TIROL 1L')).toBeLessThan(STRONG_MATCH);
    expect(sim('SABAO PO OMO 800G', 'CAFE PILAO 500G')).toBeLessThan(WEAK_MATCH);
  });

  it('escolhe o melhor candidato pelos textos já vinculados', () => {
    const r = bestMatch('ARR TIO JOAO T1 5KG', [
      { id: 'a', texts: ['Arroz Camil 5kg'] },
      { id: 'b', texts: ['Arroz Tio João 5kg', 'ARROZ TIO JOAO TP1 5 KG'] },
    ]);
    expect(r?.id).toBe('b');
    expect(r!.score).toBeGreaterThanOrEqual(STRONG_MATCH);
    expect(bestMatch('PILHA AA', [{ id: 'x', texts: ['Arroz 5kg'] }])).toBeUndefined();
  });
});
