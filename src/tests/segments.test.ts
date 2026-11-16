import { db } from '@/db/database';
import { SEG_COMBUSTIVEL, SEG_FARMACIA, SEG_MERCADO } from '@/db/defaults';
import { deletePlace, deleteSegment, savePlace, saveSegment } from '@/repositories/places';
import { saveProduct } from '@/repositories/catalog';
import { saveFuelPrice, savePrice } from '@/repositories/prices';
import { analyzeBackup, applyBackup } from '@/services/backup';
import { resetDb } from './db-helpers';

beforeEach(resetDb);

const place = (segmentId: string, name = 'Lugar') => savePlace({ segmentId, name, color: '#2a78d6', active: true });

describe('tipos de lugar e lugares', () => {
  it('cria tipo novo no modo itens, no fim da ordem, e recusa nome repetido', async () => {
    const id = await saveSegment({ name: 'Pet shop', icon: 'paw', color: '#e87ba4' });
    const seg = (await db.segments.get(id))!;
    expect(seg.mode).toBe('items');
    expect(seg.builtin).toBe(false);
    expect(seg.order).toBe(3);
    await expect(saveSegment({ name: 'pet SHOP', icon: 'paw', color: '#e87ba4' })).rejects.toThrow(/Já existe/);
  });

  it('tipos padrão podem ser renomeados, mas não excluídos', async () => {
    await saveSegment({ name: 'Supermercado', icon: 'cart', color: '#2a78d6' }, SEG_MERCADO);
    const seg = (await db.segments.get(SEG_MERCADO))!;
    expect(seg.name).toBe('Supermercado');
    expect(seg.builtin).toBe(true);
    await expect(deleteSegment(SEG_FARMACIA)).rejects.toThrow(/não excluídos/);
  });

  it('não exclui tipo com lugares; sem lugares, solta categorias e produtos', async () => {
    const pet = await saveSegment({ name: 'Pet shop', icon: 'paw', color: '#e87ba4' });
    const p = await place(pet, 'Pet da esquina');
    await expect(deleteSegment(pet)).rejects.toThrow(/lugar/);
    await deletePlace(p);
    const prod = await saveProduct({ name: 'Ração', segmentId: pet, unit: 'kg', packageSize: 10 });
    await deleteSegment(pet);
    expect(await db.segments.get(pet)).toBeUndefined();
    expect((await db.products.get(prod))!.segmentId).toBeUndefined();
  });

  it('flag (bandeira) só é guardada em postos', async () => {
    const a = await savePlace({ segmentId: SEG_FARMACIA, name: 'Drogaria', color: '#1baf7a', active: true, flag: 'Shell' });
    const b = await savePlace({ segmentId: SEG_COMBUSTIVEL, name: 'Posto', color: '#eda100', active: true, flag: 'Shell' });
    expect((await db.stores.get(a))!.flag).toBeUndefined();
    expect((await db.stores.get(b))!.flag).toBe('Shell');
  });

  it('não troca entre combustível e produtos quando já há preços', async () => {
    const posto = await place(SEG_COMBUSTIVEL, 'Posto');
    await saveFuelPrice({ stationId: posto, fuel: 'etanol', price: 4.19, date: '2026-11-01T12:00:00Z' });
    await expect(savePlace({ segmentId: SEG_MERCADO, name: 'Posto', color: '#eda100', active: true }, posto)).rejects.toThrow(/combustível/);
    const merc = await place(SEG_MERCADO, 'Mercado');
    const prod = await saveProduct({ name: 'Leite', unit: 'L', packageSize: 1 });
    await savePrice({ productId: prod, storeId: merc, price: 4.5, date: '2026-11-01T12:00:00Z' });
    await expect(savePlace({ segmentId: SEG_COMBUSTIVEL, name: 'Mercado', color: '#2a78d6', active: true }, merc)).rejects.toThrow(/combustível/);
    // entre tipos de produtos pode trocar
    await savePlace({ segmentId: SEG_FARMACIA, name: 'Mercado', color: '#2a78d6', active: true }, merc);
    expect((await db.stores.get(merc))!.segmentId).toBe(SEG_FARMACIA);
  });

  it('excluir posto apaga os preços de combustível dele', async () => {
    const posto = await place(SEG_COMBUSTIVEL, 'Posto');
    await saveFuelPrice({ stationId: posto, fuel: 'gnv', price: 4.99, date: '2026-11-01T12:00:00Z' });
    await deletePlace(posto);
    expect(await db.fuelPrices.count()).toBe(0);
  });
});

describe('backup antigo (esquema 2, com postos separados)', () => {
  it('migra mercados e postos para lugares ao importar', async () => {
    const now = '2026-10-01T12:00:00.000Z';
    const old = {
      app: 'precivora',
      format: 1,
      schemaVersion: 2,
      exportedAt: now,
      data: {
        stores: [{ id: 's1', name: 'Mercado A', color: '#2a78d6', active: true, createdAt: now, updatedAt: now }],
        stations: [{ id: 'st1', name: 'Posto B', color: '#eda100', active: true, createdAt: now, updatedAt: now }],
        fuelPrices: [{ id: 'f1', stationId: 'st1', fuel: 'etanol', price: 4.19, date: now, promo: false, createdAt: now, updatedAt: now }],
        categories: [{ id: 'c1', name: 'Medicamentos', color: '#0D9488', createdAt: now, updatedAt: now }],
      },
    };
    const a = await analyzeBackup(JSON.stringify(old), 'replace');
    expect(a.errors).toEqual([]);
    expect(a.ok).toBe(true);
    await applyBackup(a, 'replace');
    expect((await db.stores.get('s1'))!.segmentId).toBe(SEG_MERCADO);
    expect((await db.stores.get('st1'))!.segmentId).toBe(SEG_COMBUSTIVEL);
    expect((await db.categories.get('c1'))!.segmentId).toBe(SEG_FARMACIA);
    expect(await db.segments.count()).toBe(3);
  });

  it('mescla tipo criado em outro aparelho com o mesmo nome sem duplicar', async () => {
    const mine = await saveSegment({ name: 'Pet shop', icon: 'paw', color: '#e87ba4' });
    const now = '2026-10-01T12:00:00.000Z';
    const other = {
      app: 'precivora',
      format: 1,
      schemaVersion: 3,
      exportedAt: now,
      data: {
        segments: [{ id: 'outro-pet', name: 'Pet Shop', icon: 'paw', color: '#e87ba4', mode: 'items', builtin: false, order: 3, createdAt: now, updatedAt: now }],
        stores: [{ id: 'pet1', segmentId: 'outro-pet', name: 'Pet do bairro', color: '#e87ba4', active: true, createdAt: now, updatedAt: now }],
      },
    };
    const a = await analyzeBackup(JSON.stringify(other), 'merge');
    expect(a.ok).toBe(true);
    await applyBackup(a, 'merge');
    expect(await db.segments.count()).toBe(4);
    expect((await db.stores.get('pet1'))!.segmentId).toBe(mine);
  });
});
