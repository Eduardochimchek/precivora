/**
 * Gera um backup de DEMONSTRAÇÃO (dados fictícios) usado só pelos testes ponta a ponta
 * e para screenshots. Nunca é carregado automaticamente pelo app.
 */
import { randomUUID } from 'node:crypto';

const day = 86_400_000;
const ago = (d, h = 12) => {
  const t = new Date(Date.now() - d * day);
  t.setHours(h, 0, 0, 0);
  return t.toISOString();
};
const key = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const stamp = (d = 90) => ({ createdAt: ago(d), updatedAt: ago(d) });

export function buildSampleBackup() {
  const id = () => randomUUID();
  const MERC = 'seg-mercado';
  const FARM = 'seg-farmacia';
  const COMB = 'seg-combustivel';
  const segments = [
    { id: MERC, name: 'Mercado', icon: 'cart', color: '#2a78d6', mode: 'items', builtin: true, order: 0, ...stamp() },
    { id: FARM, name: 'Farmácia', icon: 'pill', color: '#1baf7a', mode: 'items', builtin: true, order: 1, ...stamp() },
    { id: COMB, name: 'Combustível', icon: 'fuel', color: '#eda100', mode: 'fuel', builtin: true, order: 2, ...stamp() },
  ];
  const stores = [
    { id: id(), segmentId: MERC, name: 'Supermercado Vila Nova', neighborhood: 'Centro', city: 'Curitiba', color: '#2a78d6', active: true, ...stamp() },
    { id: id(), segmentId: MERC, name: 'Atacarejo Rota 5', neighborhood: 'Boqueirão', city: 'Curitiba', color: '#eb6834', active: true, ...stamp() },
    { id: id(), segmentId: MERC, name: 'Mercado da Esquina', neighborhood: 'Água Verde', city: 'Curitiba', color: '#1baf7a', active: true, ...stamp() },
    { id: id(), segmentId: FARM, name: 'Drogaria Central', neighborhood: 'Centro', city: 'Curitiba', color: '#6250d6', active: true, ...stamp() },
    { id: id(), segmentId: FARM, name: 'Farmácia Popular do Bairro', neighborhood: 'Água Verde', city: 'Curitiba', color: '#e34948', active: true, ...stamp() },
  ];
  const stations = [
    { id: id(), segmentId: COMB, name: 'Posto Avenida', flag: 'Bandeira branca', city: 'Curitiba', color: '#eda100', active: true, ...stamp() },
    { id: id(), segmentId: COMB, name: 'Posto Trevo', city: 'Curitiba', color: '#e87ba4', active: true, ...stamp() },
    { id: id(), segmentId: COMB, name: 'Auto Posto Serra', city: 'Curitiba', color: '#6250d6', active: true, ...stamp() },
  ];
  const brandNames = ['Grão Fino', 'Campo Sul', 'Vale Verde', 'Leiteria Serra', 'Brilho'];
  const brands = brandNames.map((name) => ({ id: id(), name, nameKey: key(name), ...stamp() }));
  const B = Object.fromEntries(brands.map((b) => [b.name, b.id]));
  const categories = [
    { id: id(), name: 'Mercearia', color: '#D97706', segmentId: MERC, ...stamp() },
    { id: id(), name: 'Laticínios e frios', color: '#0EA5E9', segmentId: MERC, ...stamp() },
    { id: id(), name: 'Limpeza', color: '#0891B2', segmentId: MERC, ...stamp() },
    { id: id(), name: 'Hortifrúti', color: '#16A34A', segmentId: MERC, ...stamp() },
    { id: id(), name: 'Medicamentos', color: '#0D9488', segmentId: FARM, ...stamp() },
    { id: id(), name: 'Dermocosméticos', color: '#C026D3', segmentId: FARM, ...stamp() },
  ];
  const C = Object.fromEntries(categories.map((c) => [c.name, c.id]));
  const prod = (name, brand, cat, unit, packageSize, sub, segmentId = MERC) => ({
    id: id(), name, nameKey: key(name), segmentId, brandId: B[brand], categoryId: C[cat], subcategory: sub, unit, packageSize, archived: false, ...stamp(),
  });
  const products = [
    prod('Arroz agulhinha tipo 1', 'Grão Fino', 'Mercearia', 'kg', 5, 'Grãos'),
    prod('Arroz agulhinha tipo 1', 'Campo Sul', 'Mercearia', 'kg', 1, 'Grãos'),
    prod('Feijão carioca', 'Campo Sul', 'Mercearia', 'kg', 1, 'Grãos'),
    prod('Café torrado e moído', 'Vale Verde', 'Mercearia', 'g', 500, 'Café'),
    prod('Leite integral', 'Leiteria Serra', 'Laticínios e frios', 'L', 1),
    prod('Ovos brancos', undefined, 'Hortifrúti', 'dz', 1),
    prod('Detergente neutro', 'Brilho', 'Limpeza', 'ml', 500),
    prod('Dipirona 500 mg (20 comprimidos)', undefined, 'Medicamentos', 'cx', 1, 'Analgésicos', FARM),
    prod('Protetor solar FPS 50', undefined, 'Dermocosméticos', 'ml', 200, undefined, FARM),
    { id: id(), name: 'Escova de dente macia', nameKey: key('Escova de dente macia'), unit: 'un', packageSize: 1, archived: false, ...stamp() },
  ];
  const [arroz5, arroz1, feijao, cafe, leite, ovos, deterg, dipirona, protetor, escova] = products.map((p) => p.id);
  const [s1, s2, s3, f1, f2] = stores.map((s) => s.id);
  const prices = [];
  const price = (productId, storeId, value, d, extra = {}) =>
    prices.push({ id: id(), productId, storeId, price: value, quantity: 1, date: ago(d), promo: false, source: 'manual', ...stamp(d), ...extra });
  price(arroz5, s1, 27.9, 60); price(arroz5, s1, 26.5, 30); price(arroz5, s1, 25.9, 6);
  price(arroz5, s2, 24.9, 20); price(arroz5, s2, 23.9, 3, { promo: true });
  price(arroz5, s3, 28.49, 12);
  price(arroz1, s1, 5.79, 40); price(arroz1, s3, 5.49, 5);
  price(feijao, s1, 8.99, 50); price(feijao, s2, 7.49, 8); price(feijao, s3, 9.29, 4);
  price(cafe, s1, 17.9, 70); price(cafe, s1, 19.9, 25); price(cafe, s2, 21.5, 2);
  price(leite, s1, 4.89, 45); price(leite, s2, 4.59, 9); price(leite, s3, 5.19, 1);
  price(ovos, s3, 12.9, 3); price(ovos, s2, 11.49, 15);
  price(deterg, s2, 6.0, 7, { quantity: 3 }); price(deterg, s1, 2.39, 2);
  price(dipirona, f1, 12.9, 20); price(dipirona, f1, 11.5, 4); price(dipirona, f2, 9.99, 6, { promo: true });
  price(protetor, f1, 69.9, 10); price(protetor, f2, 59.9, 3);
  price(escova, f1, 8.9, 5); price(escova, s1, 6.49, 4);

  const [p1, p2, p3] = stations.map((s) => s.id);
  const fuelPrices = [];
  const fp = (stationId, fuel, v, d) => fuelPrices.push({ id: id(), stationId, fuel, price: v, date: ago(d, 8), promo: false, ...stamp(d) });
  fp(p1, 'gasolina_comum', 6.29, 9); fp(p1, 'gasolina_comum', 6.19, 1); fp(p1, 'etanol', 4.19, 1);
  fp(p2, 'gasolina_comum', 6.05, 2); fp(p2, 'etanol', 4.09, 2); fp(p2, 'diesel_s10', 6.39, 2);
  fp(p3, 'gasolina_comum', 6.29, 3); fp(p3, 'etanol', 4.39, 3); fp(p3, 'diesel_s10', 6.19, 3);

  const purchases = [];
  const purchaseItems = [];
  const buy = (storeId, d, items) => {
    const pid = id();
    const total = Math.round(items.reduce((s, [, q, u]) => s + q * u, 0) * 100) / 100;
    purchases.push({ id: pid, storeId, date: ago(d), total, ...stamp(d) });
    for (const [productId, quantity, unitPrice] of items) {
      purchaseItems.push({ id: id(), purchaseId: pid, productId, quantity, unitPrice });
      prices.push({ id: id(), productId, storeId, price: unitPrice, quantity: 1, date: ago(d), promo: false, source: 'purchase', purchaseId: pid, ...stamp(d) });
    }
  };
  buy(s2, 35, [[arroz5, 1, 24.9], [feijao, 2, 7.69], [leite, 12, 4.49]]);
  buy(s1, 4, [[cafe, 2, 18.9], [leite, 6, 4.79], [deterg, 3, 2.39]]);
  buy(s2, 1, [[arroz5, 1, 23.9], [feijao, 2, 7.49], [ovos, 1, 11.49]]);

  const review = (targetType, targetId, overall, quality, value, comment, extra = {}) => ({
    id: id(), targetType, targetId, overall, quality, value, comment, favorite: false, avoid: false, date: ago(10), ...stamp(10), ...extra,
  });
  const reviews = [
    review('product', arroz5, 5, 5, 4, 'Rende bem e não empapa.', { favorite: true }),
    review('product', arroz1, 2, 2, 3, 'Quebra muito no cozimento.'),
    review('product', cafe, 4, 5, 3, 'Encorpado.'),
    review('brand', B['Brilho'], 1, 1, 2, 'Não faz espuma.', { avoid: true }),
  ];
  const listId = id();
  const lists = [{ id: listId, name: 'Compra do mês', archived: false, ...stamp(2) }];
  const li = (productId, quantity, priority) => ({ id: id(), listId, productId, quantity, priority, checked: false, ...stamp(2) });
  const listItems = [li(arroz5, 1, 'alta'), li(feijao, 2, 'alta'), li(leite, 12, 'media'), li(cafe, 1, 'media'), li(ovos, 1, 'baixa')];
  const categoryBudgets = [{ id: id(), categoryId: C['Mercearia'], limit: 300 }];
  const settings = [
    { key: 'monthlyBudget', value: 900 },
    { key: 'savingsGoal', value: 60 },
  ];

  return {
    app: 'precivora',
    format: 1,
    schemaVersion: 3,
    exportedAt: new Date().toISOString(),
    data: { segments, categories, brands, products, stores: [...stores, ...stations], prices, fuelPrices, reviews, purchases, purchaseItems, lists, listItems, categoryBudgets, activities: [], settings },
  };
}
