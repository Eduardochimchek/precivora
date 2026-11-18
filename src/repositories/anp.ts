import { db } from '@/db/database';
import { SEG_COMBUSTIVEL } from '@/db/defaults';
import type { FuelPrice, ID, Place } from '@/types';
import { fuelPriceSchema, placeSchema } from '@/services/schemas';
import { ANP_NOTE_PREFIX, anpAddress, anpNote, anpStationName, anpTitle, cityKey, type AnpRow } from '@/services/anp';
import { newId } from '@/utils/id';
import { nowISO } from '@/utils/date';
import { validate } from './errors';
import { logActivity } from './activity';

export interface AnpResult {
  added: number;
  stationsCreated: number;
  stationsMatched: number;
  latest?: string;
}

const FLAG_COLOR: Record<string, string> = { Ipiranga: '#F7C600', Shell: '#DD1D21', Petrobras: '#008542', Ale: '#0055A4' };
const OTHER_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#6250d6', '#e34948', '#008300'];

/**
 * Grava os preços do levantamento da ANP nos postos cadastrados (pelo CNPJ).
 * Postos pesquisados nas cidades onde a pessoa já tem posto, e que ainda não existem no app, são cadastrados
 * (cidade com o mesmo nome em mais de um estado só quando um posto conhecido confirma o estado).
 * A mesma coleta (posto, combustível e dia) nunca entra duas vezes.
 */
export async function applyAnpRows(rows: AnpRow[]): Promise<AnpResult> {
  const segments = await db.segments.toArray();
  const fuelSegs = new Set(segments.filter((s) => s.mode === 'fuel').map((s) => s.id));
  const fuelSegment = segments.find((s) => s.id === SEG_COMBUSTIVEL && s.mode === 'fuel') ?? segments.find((s) => s.mode === 'fuel');
  if (!fuelSegment) return { added: 0, stationsCreated: 0, stationsMatched: 0 };

  const places = await db.stores.toArray();
  const byCnpj = new Map<string, Place>();
  const fuelCities = new Map<string, string>();
  for (const p of places) {
    if (!fuelSegs.has(p.segmentId)) continue;
    if (p.cnpj) byCnpj.set(p.cnpj, p);
    if (p.city) fuelCities.set(cityKey(p.city), p.city);
  }

  const ufsByCity = new Map<string, Set<string>>();
  const knownUf = new Map<string, string>();
  for (const r of rows) {
    const ck = cityKey(r.city);
    if (!fuelCities.has(ck)) continue;
    if (!ufsByCity.has(ck)) ufsByCity.set(ck, new Set());
    ufsByCity.get(ck)!.add(r.uf);
    if (byCnpj.has(r.cnpj)) knownUf.set(ck, r.uf);
  }
  const inMyCities = (r: AnpRow) => {
    const ck = cityKey(r.city);
    const ufs = ufsByCity.get(ck);
    return !!ufs && (ufs.size === 1 || knownUf.get(ck) === r.uf);
  };
  const relevant = rows.filter((r) => byCnpj.has(r.cnpj) || inMyCities(r));
  if (!relevant.length) return { added: 0, stationsCreated: 0, stationsMatched: 0 };

  const now = nowISO();
  return db.transaction('rw', [db.stores, db.fuelPrices, db.activities], async () => {
    let stationsCreated = 0;
    const newStations: Place[] = [];
    for (const r of relevant) {
      if (byCnpj.has(r.cnpj)) continue;
      const place: Place = validate(placeSchema, {
        id: newId(),
        segmentId: fuelSegment.id,
        name: anpStationName(r.name),
        address: anpAddress(r) || undefined,
        neighborhood: r.neighborhood ? anpTitle(r.neighborhood).slice(0, 80) : undefined,
        city: fuelCities.get(cityKey(r.city)),
        flag: r.flag,
        cnpj: r.cnpj,
        color: (r.flag && FLAG_COLOR[r.flag]) || OTHER_COLORS[Number(r.cnpj.slice(-3)) % OTHER_COLORS.length],
        active: true,
        createdAt: now,
        updatedAt: now,
      });
      byCnpj.set(r.cnpj, place);
      newStations.push(place);
      stationsCreated++;
    }
    if (newStations.length) await db.stores.bulkAdd(newStations);

    const stationIds = [...new Set(relevant.map((r) => byCnpj.get(r.cnpj)!.id))];
    const existing = await db.fuelPrices.where('stationId').anyOf(stationIds).toArray();
    const seen = new Set(existing.filter((f) => f.notes?.startsWith(ANP_NOTE_PREFIX)).map((f) => `${f.stationId}|${f.fuel}|${f.date.slice(0, 10)}`));
    const records: FuelPrice[] = [];
    let latest: string | undefined;
    for (const r of relevant) {
      const stationId: ID = byCnpj.get(r.cnpj)!.id;
      const key = `${stationId}|${r.fuel}|${r.date.slice(0, 10)}`;
      if (!latest || r.date > latest) latest = r.date;
      if (seen.has(key)) continue;
      seen.add(key);
      records.push(
        validate(fuelPriceSchema, {
          id: newId(),
          stationId,
          fuel: r.fuel,
          price: Math.round(r.price * 1000) / 1000,
          date: r.date,
          promo: false,
          notes: anpNote(r.date),
          createdAt: now,
          updatedAt: now,
        }),
      );
    }
    if (records.length) await db.fuelPrices.bulkAdd(records);
    if (records.length || stationsCreated) {
      await logActivity('fuel', `ANP: ${records.length} preço${records.length === 1 ? '' : 's'} de combustível${stationsCreated ? `, ${stationsCreated} posto${stationsCreated === 1 ? '' : 's'} novo${stationsCreated === 1 ? '' : 's'}` : ''}`);
    }
    return { added: records.length, stationsCreated, stationsMatched: stationIds.length, latest };
  });
}
