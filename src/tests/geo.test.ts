import { describe, expect, it } from 'vitest';
import { distanceKm, formatDistance, geocodeQueries, readGeocode, splitStreet } from '@/services/geo';
import { needsGeocode } from '@/app/geocodeRunner';
import type { Place } from '@/types';

describe('localização dos lugares', () => {
  it('separa rua e número do endereço', () => {
    expect(splitStreet('Avenida Centenário, 3985')).toEqual({ street: 'Avenida Centenário', number: '3985' });
    expect(splitStreet('Rua X, 123 - Sala 2')).toEqual({ street: 'Rua X', number: '123' });
    expect(splitStreet('Rodovia SC 445, s/n')).toEqual({ street: 'Rodovia SC 445' });
    expect(splitStreet('Rua das Flores 20')).toEqual({ street: 'Rua das Flores', number: '20' });
    expect(splitStreet(undefined)).toEqual({});
  });

  it('monta os pedidos do mais preciso ao bairro', () => {
    expect(geocodeQueries({ address: 'Rua Henrique Lage, 798', neighborhood: 'Centro', city: 'Criciúma' })).toEqual([
      { params: { city: 'Criciúma', countrycodes: 'br', street: '798 Rua Henrique Lage' }, level: 'exact' },
      { params: { q: 'Centro, Criciúma', countrycodes: 'br' }, level: 'area' },
    ]);
    expect(geocodeQueries({ address: 'Rua X' })).toEqual([]);
  });

  it('lê a resposta e recusa outra cidade', () => {
    const q = { params: {}, level: 'exact' as const };
    expect(readGeocode([{ lat: '-28.68', lon: '-49.37', address: { house_number: '798', city: 'Criciúma' } }], q, 'Criciuma')).toEqual({ lat: -28.68, lng: -49.37, geo: 'exact' });
    expect(readGeocode([{ lat: '-28.68', lon: '-49.37', address: { city: 'Criciúma' } }], q, 'Criciúma')?.geo).toBe('street');
    expect(readGeocode([{ lat: '-27.5', lon: '-48.5', address: { city: 'Florianópolis' } }], q, 'Criciúma')).toBeUndefined();
    expect(readGeocode([], q, 'Criciúma')).toBeUndefined();
  });

  it('calcula e mostra distâncias', () => {
    const d = distanceKm({ lat: -28.6775, lng: -49.3697 }, { lat: -28.7066, lng: -49.4103 });
    expect(d).toBeGreaterThan(4.5);
    expect(d).toBeLessThan(5.5);
    expect(formatDistance(0.234)).toBe('230 m');
    expect(formatDistance(4.83)).toBe('4,8 km');
    expect(formatDistance(23.4)).toBe('23 km');
  });

  it('decide quem ainda precisa ser localizado', () => {
    const base = { city: 'Criciúma' } as Place;
    expect(needsGeocode(base)).toBe(true);
    expect(needsGeocode({ ...base, geo: 'exact' })).toBe(false);
    expect(needsGeocode({ ...base, geo: 'none', geoAt: new Date().toISOString() })).toBe(false);
    expect(needsGeocode({ ...base, geo: 'none', geoAt: '2020-01-01T00:00:00.000Z' })).toBe(true);
    expect(needsGeocode({} as Place)).toBe(false);
  });
});
