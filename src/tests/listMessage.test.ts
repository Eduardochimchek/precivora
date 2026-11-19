import { describe, expect, it } from 'vitest';
import { buildListMessage } from '@/services/listMessage';

const d = new Date(2026, 10, 19);

describe('mensagem da lista para compartilhar', () => {
  it('agrupa pelo lugar mais barato, soma o total e lista comprados riscados', () => {
    const msg = buildListMessage(
      'Compra do mês',
      [
        { name: 'Arroz', pkg: '5 kg', quantity: 1, checked: false, storeName: 'Atacarejo', price: 23.9 },
        { name: 'Feijão', pkg: '1 kg', quantity: 2, checked: false, storeName: 'Atacarejo', price: 7.49 },
        { name: 'Leite', pkg: '1 L', quantity: 1, checked: false, storeName: 'Mercado da Esquina', price: 4.59 },
        { name: 'Sabão', quantity: 1, checked: false },
        { name: 'Café', quantity: 1, checked: true },
      ],
      d,
    ).replace(/ /g, ' ');
    expect(msg).toContain('🛒 *Compra do mês*');
    expect(msg).toContain('_4 itens para comprar · 19/11_');
    expect(msg).toContain('📍 *Atacarejo* · R$ 38,88');
    expect(msg).toContain('☐ 2x Feijão (1 kg) · R$ 14,98');
    expect(msg).toContain('📍 *Mercado da Esquina* · R$ 4,59');
    expect(msg).toContain('❔ *Ainda sem preço*\n☐ Sabão');
    expect(msg).toContain('~Café~');
    expect(msg).toContain('💰 *Total estimado: R$ 43,47* _(sem 1 item sem preço)_');
    expect(msg).toContain('Dividido entre os lugares');
  });

  it('sem nenhum preço vira uma lista simples, sem total', () => {
    const msg = buildListMessage('Feira', [{ name: 'Banana', quantity: 1, checked: false }], d);
    expect(msg).toContain('📝 *Itens*\n☐ Banana');
    expect(msg).not.toContain('Total');
  });
});
