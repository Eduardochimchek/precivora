import { describe, expect, it, vi } from 'vitest';
import { isValidGtin, lookupBarcode, parsePackage, productFromApi } from '@/services/productLookup';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('busca de produto pelo código de barras', () => {
  it('confere o dígito verificador', () => {
    expect(isValidGtin('7891000100103')).toBe(true);
    expect(isValidGtin('7894900011517')).toBe(true);
    expect(isValidGtin('7891000100104')).toBe(false);
    expect(isValidGtin('96385074')).toBe(true);
    expect(isValidGtin('123')).toBe(false);
  });

  it('converte a embalagem para as unidades do app', () => {
    expect(parsePackage(395, 'g')).toEqual({ unit: 'g', packageSize: 395 });
    expect(parsePackage(2000, 'ml')).toEqual({ unit: 'L', packageSize: 2 });
    expect(parsePackage(5000, 'g')).toEqual({ unit: 'kg', packageSize: 5 });
    expect(parsePackage(undefined, undefined, '1,5 L')).toEqual({ unit: 'L', packageSize: 1.5 });
    expect(parsePackage(undefined, undefined, '33 cl')).toEqual({ unit: 'ml', packageSize: 330 });
    expect(parsePackage(undefined, undefined, '6 x 350 ml')).toBeUndefined();
    expect(parsePackage(undefined, undefined, '10 unidades')).toBeUndefined();
  });

  it('monta o produto a partir da resposta da base', () => {
    const p = productFromApi(
      '7894900011517',
      {
        status: 1,
        product: {
          product_name_pt: '  Refrigerante Coca-Cola 2Lt ',
          brands: 'Coca-Cola, The Coca-Cola Company',
          product_quantity: 2000,
          product_quantity_unit: 'ml',
          image_front_small_url: 'https://images.openfoodfacts.org/images/products/789/490/001/1517/front_pt.13.200.jpg',
        },
      },
      'Open Food Facts',
    );
    expect(p).toMatchObject({ name: 'Refrigerante Coca-Cola 2Lt', brand: 'Coca-Cola', unit: 'L', packageSize: 2 });
    expect(p?.imageUrl).toMatch(/^https:\/\/images\.openfoodfacts\.org\//);
    expect(productFromApi('1', { status: 1, product: { image_front_small_url: 'https://outro.site/x.jpg' } }, 'x')?.imageUrl).toBeUndefined();
    expect(productFromApi('1', { status: 0 }, 'x')).toBeUndefined();
  });

  it('procura na base certa quando o código é de outro tipo de produto', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ status: 0, status_verbose: 'product found with a different product type: beauty' }, 404))
      .mockResolvedValueOnce(json({ status: 1, product: { product_name: 'Shampoo', quantity: '350 ml' } }));
    const p = await lookupBarcode('7891024134702', fetchMock as unknown as typeof fetch);
    expect(fetchMock.mock.calls[1][0]).toMatch(/openbeautyfacts\.org\/api\/v2\/product\/7891024134702\.json/);
    expect(p).toMatchObject({ name: 'Shampoo', unit: 'ml', packageSize: 350, source: 'Open Beauty Facts' });
  });

  it('não encontrado e sem rede são casos diferentes', async () => {
    const notFound = vi.fn().mockResolvedValue(json({ status: 0, status_verbose: 'product not found' }, 404));
    await expect(lookupBarcode('7896004000855', notFound as unknown as typeof fetch)).resolves.toBeUndefined();
    expect(notFound).toHaveBeenCalledTimes(1);
    const offline = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(lookupBarcode('7896004000855', offline as unknown as typeof fetch)).rejects.toThrow();
  });
});
