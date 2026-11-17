import { db } from '@/db/database';
import { SEG_COMBUSTIVEL, SEG_MERCADO } from '@/db/defaults';
import { consultationUrl, extractAccessKey, fuelFromDescription, guessPackage, parseBrNumber, parseReceiptHtml, prettyItemName, ReceiptParseError } from '@/services/nfce';
import { draftFromReceipt, fuelDecisions, importReceipt, type ItemDecision } from '@/repositories/receipts';
import { savePlace } from '@/repositories/places';
import { ValidationError } from '@/repositories/errors';
import { FUEL_RECEIPT, MARKET_RECEIPT, PLAIN_RECEIPT, SECURITY_PAGE } from './fixtures/nfce';
import { resetDb } from './db-helpers';

describe('leitura da NFC-e', () => {
  it('lê lugar, itens, total, data e chave do layout nacional', () => {
    const r = parseReceiptHtml(MARKET_RECEIPT);
    expect(r.store).toEqual({ name: 'Mercado Exemplo Do Bairro Ltda', cnpj: '12345678000190', address: 'Rua Das Flores, 100', neighborhood: 'Centro', city: 'Joinville' });
    expect(r.items).toHaveLength(3);
    expect(r.items[1]).toEqual({ description: 'BANANA PRATA KG', code: '210', quantity: 1.235, unit: 'KG', unitPrice: 6.99, total: 8.63 });
    expect(r.total).toBe(87.17);
    expect(r.number).toBe('4321');
    expect(r.accessKey).toMatch(/^4226\d{40}$/);
    const d = new Date(r.issuedAt!);
    expect([d.getDate(), d.getMonth() + 1, d.getFullYear(), d.getHours(), d.getMinutes()]).toEqual([14, 11, 2026, 18, 42]);
  });

  it('lê pelo texto quando a página não tem as classes do layout', () => {
    const r = parseReceiptHtml(PLAIN_RECEIPT);
    expect(r.items.map((i) => [i.description, i.quantity, i.unitPrice])).toEqual([
      ['CAFE TORRADO 500G', 1, 17.49],
      ['ACUCAR CRISTAL 1KG', 2, 4.99],
    ]);
    expect(r.store.cnpj).toBe('11222333000144');
    expect(r.total).toBe(27.47);
  });

  it('explica quando a Fazenda ainda pede a verificação', () => {
    expect(() => parseReceiptHtml(SECURITY_PAGE)).toThrow(/verificação de segurança/);
    expect(() => parseReceiptHtml('<html><body>outra coisa</body></html>')).toThrow(ReceiptParseError);
  });

  it('extrai a chave do QR Code, de link ou do texto digitado', () => {
    const key = '42261112345678000190650010000123411000123456';
    expect(extractAccessKey(`https://sat.sef.sc.gov.br/nfce/consulta?p=${key}|2|1|1|ABCDEF`)).toBe(key);
    expect(extractAccessKey(key.replace(/(\d{4})/g, '$1 '))).toBe(key);
    expect(extractAccessKey('123')).toBeUndefined();
    expect(consultationUrl(`https://sat.sef.sc.gov.br/nfce/consulta?p=${key}|2|1`)).toMatchObject({ key, needsKeyTyping: false });
    expect(consultationUrl(key)).toEqual({ url: 'https://sat.sef.sc.gov.br/nfce/consulta', key, needsKeyTyping: true });
    expect(() => consultationUrl('35' + key.slice(2))).toThrow(/Santa Catarina/);
    expect(() => consultationUrl('https://cardapio.exemplo.com/mesa/12')).toThrow(/não é de nota fiscal/);
    expect(() => consultationUrl(`https://sat.sef.sc.gov.br.golpe.com/?p=${key}`)).toThrow(/não é de nota fiscal/);
    expect(() => consultationUrl('https://sat.sef.sc.gov.br/nfce/consulta')).toThrow(/não é de nota fiscal/);
    expect(() => consultationUrl('WIFI:S:Casa;T:WPA;P:123;;')).toThrow(/não é de nota fiscal/);
    expect(consultationUrl(`http://www.fazenda.pr.gov.br/nfce/qrcode?p=${key}|2|1`)).toMatchObject({ url: `https://www.fazenda.pr.gov.br/nfce/qrcode?p=${key}|2|1`, needsKeyTyping: false });
  });

  it('sugere embalagem, combustível e nome legível', () => {
    expect(parseBrNumber('1.234,56')).toBe(1234.56);
    expect(guessPackage({ description: 'ARROZ TIPO 1 5KG', unit: 'UN' })).toEqual({ unit: 'kg', packageSize: 5 });
    expect(guessPackage({ description: 'LEITE 1L', unit: 'UN' })).toEqual({ unit: 'L', packageSize: 1 });
    expect(guessPackage({ description: 'CAFE 500G', unit: 'UN' })).toEqual({ unit: 'g', packageSize: 500 });
    expect(guessPackage({ description: 'BANANA PRATA', unit: 'KG' })).toEqual({ unit: 'kg', packageSize: 1 });
    expect(guessPackage({ description: 'SABONETE', unit: 'UN' })).toEqual({ unit: 'un', packageSize: 1 });
    expect(fuelFromDescription('GASOLINA C COMUM')).toBe('gasolina_comum');
    expect(fuelFromDescription('GASOLINA ADITIVADA')).toBe('gasolina_aditivada');
    expect(fuelFromDescription('ETANOL HIDRATADO')).toBe('etanol');
    expect(fuelFromDescription('OLEO DIESEL B S10')).toBe('diesel_s10');
    expect(fuelFromDescription('ARROZ')).toBeUndefined();
    expect(prettyItemName('ARROZ TIPO 1 BOM GRAO 5KG')).toBe('Arroz Tipo 1 Bom Grao 5kg');
    expect(prettyItemName('BANANA PRATA KG')).toBe('Banana Prata');
    expect(prettyItemName('LEITE INTEGRAL CAMPO 1L')).toBe('Leite Integral Campo 1L');
    expect(prettyItemName('CAFE 500 GR')).toBe('Cafe 500g');
  });
});

describe('importação da nota', () => {
  beforeEach(resetDb);

  const decisionsOf = (draft: Awaited<ReturnType<typeof draftFromReceipt>>): ItemDecision[] => draft.items.map((i) => i.decision);

  it('cria lugar com CNPJ, produtos, vínculos e a compra; na segunda nota reconhece tudo', async () => {
    const receipt = parseReceiptHtml(MARKET_RECEIPT);
    const draft = await draftFromReceipt(receipt);
    expect(draft.placeId).toBeUndefined();
    expect(draft.suggestedSegmentId).toBe(SEG_MERCADO);
    expect(draft.items.map((i) => i.decision.action)).toEqual(['new', 'new', 'new']);

    const res = await importReceipt({ receipt, newPlace: { name: receipt.store.name, segmentId: SEG_MERCADO, color: '#2a78d6' }, date: receipt.issuedAt!, decisions: decisionsOf(draft) });
    expect(res.imported).toBe(3);
    const place = await db.stores.get(res.placeId);
    expect(place).toMatchObject({ cnpj: '12345678000190', city: 'Joinville' });
    const purchase = await db.purchases.get(res.purchaseId!);
    expect(purchase?.receiptKey).toBe(receipt.accessKey);
    expect(purchase?.total).toBeCloseTo(49.8 + 1.235 * 6.99 + 28.74, 1);
    expect(await db.prices.where('purchaseId').equals(res.purchaseId!).count()).toBe(3);
    const arroz = await db.products.where('nameKey').equals('arroz tipo 1 bom grao 5kg').first();
    expect(arroz).toMatchObject({ unit: 'kg', packageSize: 5 });
    expect(await db.receiptLinks.count()).toBe(3);

    await expect(importReceipt({ receipt, placeId: res.placeId, date: receipt.issuedAt!, decisions: decisionsOf(draft) })).rejects.toThrow(/já foi importada/);

    const again = await draftFromReceipt({ ...receipt, accessKey: '4226' + '0'.repeat(40) });
    expect(again.placeId).toBe(res.placeId);
    expect(again.alreadyImported).toBe(false);
    expect(again.items.map((i) => [i.decision.action, i.matchedBy])).toEqual([
      ['link', 'link'],
      ['link', 'link'],
      ['link', 'link'],
    ]);
  });

  it('respeita itens ignorados e vínculo a produto existente', async () => {
    const receipt = parseReceiptHtml(MARKET_RECEIPT);
    const placeId = await savePlace({ segmentId: SEG_MERCADO, name: 'Mercado do bairro', color: '#2a78d6', active: true });
    const draft = await draftFromReceipt(receipt);
    const decisions = decisionsOf(draft);
    decisions[2] = { action: 'skip' };
    const res = await importReceipt({ receipt, placeId, date: receipt.issuedAt!, decisions });
    expect(res.imported).toBe(2);
    expect((await db.stores.get(placeId))?.cnpj).toBe('12345678000190');
    await expect(importReceipt({ receipt: { ...receipt, accessKey: undefined }, placeId, date: receipt.issuedAt!, decisions: decisions.map(() => ({ action: 'skip' as const })) })).rejects.toThrow(ValidationError);
  });

  it('nota de posto vira preço de combustível', async () => {
    const receipt = parseReceiptHtml(FUEL_RECEIPT);
    const draft = await draftFromReceipt(receipt);
    expect(draft.suggestedSegmentId).toBe(SEG_COMBUSTIVEL);
    expect(draft.fuelPlace).toBe(true);
    expect(fuelDecisions(draft)).toEqual([{ action: 'fuel', fuel: 'gasolina_comum' }]);
    const res = await importReceipt({ receipt, newPlace: { name: 'Posto Exemplo', segmentId: SEG_COMBUSTIVEL, color: '#eb6834' }, date: receipt.issuedAt!, decisions: fuelDecisions(draft) });
    const fuel = await db.fuelPrices.where('stationId').equals(res.placeId).toArray();
    expect(fuel).toHaveLength(1);
    expect(fuel[0]).toMatchObject({ fuel: 'gasolina_comum', price: 6.49, receiptKey: receipt.accessKey });
    expect((await draftFromReceipt(receipt)).alreadyImported).toBe(true);
  });
});
