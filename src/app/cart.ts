import type { ID } from '@/types';

/** Carrinho do modo mercado: lugar e preço pago por item da lista. Fica no aparelho até registrar a compra. */
export interface Cart {
  storeId: ID | '';
  prices: Record<ID, number>;
}

const key = (listId: ID) => `precivora:carrinho:${listId}`;

export function loadCart(listId: ID): Cart {
  try {
    const v = JSON.parse(localStorage.getItem(key(listId)) ?? 'null') as Cart | null;
    if (v && typeof v === 'object' && v.prices) return { storeId: v.storeId ?? '', prices: v.prices };
  } catch {
    /* sem armazenamento ou dado inválido: carrinho vazio */
  }
  return { storeId: '', prices: {} };
}

export function saveCart(listId: ID, cart: Cart): void {
  try {
    localStorage.setItem(key(listId), JSON.stringify(cart));
  } catch {
    /* sem armazenamento: o carrinho vale só nesta abertura */
  }
}

export function clearCart(listId: ID): void {
  try {
    localStorage.removeItem(key(listId));
  } catch {
    /* nada a limpar */
  }
}
