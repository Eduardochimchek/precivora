import { money } from '@/utils/format';

export interface ListMessageItem {
  name: string;
  pkg?: string;
  quantity: number;
  checked: boolean;
  /** Onde sai mais barato, quando há preço. */
  storeName?: string;
  /** Preço de uma embalagem nesse lugar. */
  price?: number;
}

const qty = (q: number) => (q === 1 ? '' : `${String(q).replace('.', ',')}x `);
const label = (i: ListMessageItem) => `${qty(i.quantity)}${i.name}${i.pkg ? ` (${i.pkg})` : ''}`;

/** Mensagem da lista no formato do WhatsApp (*negrito*, _itálico_, ~riscado~), agrupada pelo lugar mais barato. */
export function buildListMessage(title: string, items: ListMessageItem[], date = new Date()): string {
  const pending = items.filter((i) => !i.checked);
  const done = items.filter((i) => i.checked);
  const lines: string[] = [`🛒 *${title}*`, `_${pending.length} ${pending.length === 1 ? 'item' : 'itens'} para comprar · ${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}_`];

  const groups = new Map<string, ListMessageItem[]>();
  const unpriced: ListMessageItem[] = [];
  for (const i of pending) {
    if (i.storeName && i.price != null) groups.set(i.storeName, [...(groups.get(i.storeName) ?? []), i]);
    else unpriced.push(i);
  }

  let total = 0;
  for (const [store, its] of groups) {
    const sub = its.reduce((s, i) => s + i.price! * i.quantity, 0);
    total += sub;
    lines.push('', `📍 *${store}* · ${money(sub)}`);
    for (const i of its) lines.push(`☐ ${label(i)} · ${money(i.price! * i.quantity)}`);
  }
  if (unpriced.length) {
    lines.push('', groups.size ? '❔ *Ainda sem preço*' : '📝 *Itens*');
    for (const i of unpriced) lines.push(`☐ ${label(i)}`);
  }
  if (done.length) {
    lines.push('', '✅ *Já comprados*');
    for (const i of done) lines.push(`~${label(i)}~`);
  }
  if (total > 0) {
    lines.push('', `💰 *Total estimado: ${money(total)}*${unpriced.length ? ` _(sem ${unpriced.length} ${unpriced.length === 1 ? 'item' : 'itens'} sem preço)_` : ''}`);
    if (groups.size > 1) lines.push('_Dividido entre os lugares mais baratos para cada item._');
  }
  lines.push('', '_Lista feita no Precivora_');
  return lines.join('\n');
}
