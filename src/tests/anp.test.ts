import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/database';
import { SEG_COMBUSTIVEL, SEG_MERCADO } from '@/db/defaults';
import { anpStationName, parseAnpCsv } from '@/services/anp';
import { applyAnpRows } from '@/repositories/anp';
import { savePlace } from '@/repositories/places';
import { resetDb } from './db-helpers';

const HEADER = 'ï»¿Regiao - Sigla;Estado - Sigla;Municipio;Revenda;CNPJ da Revenda;Nome da Rua;Numero Rua;Complemento;Bairro;Cep;Produto;Data da Coleta;Valor de Venda;Valor de Compra;Unidade de Medida;Bandeira';
const CSV = [
  HEADER,
  'S;SC;CRICIUMA;AUTO POSTO EXEMPLO LTDA; 11.111.111/0001-11;AVENIDA CENTENARIO;100;;CENTRO;88800-000;GASOLINA;05/11/2026;6,39;;R$ / litro;IPIRANGA',
  'S;SC;CRICIUMA;AUTO POSTO EXEMPLO LTDA; 11.111.111/0001-11;AVENIDA CENTENARIO;100;;CENTRO;88800-000;ETANOL;05/11/2026;4,29;;R$ / litro;IPIRANGA',
  'S;SC;CRICIUMA;POSTO NOVO DO BAIRRO EIRELI; 22.222.222/0001-22;RUA DAS FLORES;20;SALA 1;PINHEIRINHO;88800-000;DIESEL S10;12/11/2026;6,19;;R$ / litro;BRANCA',
  'S;SC;JOINVILLE;POSTO LONGE LTDA; 33.333.333/0001-33;RUA X;1;;CENTRO;89200-000;GASOLINA;12/11/2026;6,10;;R$ / litro;RAIZEN',
  'S;SC;CRICIUMA;POSTO GLP LTDA; 44.444.444/0001-44;RUA Y;1;;CENTRO;88800-000;GLP;12/11/2026;110,00;;R$ / 13 kg;BRANCA',
].join('\n');

beforeEach(resetDb);

describe('levantamento de preços da ANP', () => {
  it('lê o CSV (com BOM em latin-1) e ignora produtos de fora', () => {
    const rows = parseAnpCsv(CSV);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({ cnpj: '11111111000111', fuel: 'gasolina_comum', price: 6.39, date: '2026-11-05T15:00:00.000Z', flag: 'Ipiranga', city: 'CRICIUMA' });
    expect(rows[2]).toMatchObject({ fuel: 'diesel_s10', flag: 'Bandeira branca' });
    expect(anpStationName('AUTO POSTO EXEMPLO DE SOUZA LTDA')).toBe('Auto Posto Exemplo de Souza');
    expect(() => parseAnpCsv('a;b\n1;2')).toThrow(/formato/);
  });

  it('grava pelo CNPJ, cadastra postos das cidades onde há posto e não repete coleta', async () => {
    const stationId = await savePlace({ segmentId: SEG_COMBUSTIVEL, name: 'Meu posto', city: 'Criciúma', color: '#2a78d6', active: true, cnpj: '11111111000111' });
    await savePlace({ segmentId: SEG_MERCADO, name: 'Mercado', city: 'Joinville', color: '#2a78d6', active: true });
    const rows = parseAnpCsv(CSV);
    const r = await applyAnpRows(rows);
    expect(r).toMatchObject({ added: 3, stationsCreated: 1, stationsMatched: 2, latest: '2026-11-12T15:00:00.000Z' });
    const created = (await db.stores.where('cnpj').equals('22222222000122').first())!;
    expect(created).toMatchObject({ name: 'Posto Novo do Bairro', city: 'Criciúma', neighborhood: 'Pinheirinho', flag: 'Bandeira branca', segmentId: SEG_COMBUSTIVEL });
    expect(created.address).toBe('Rua das Flores, 20 - Sala 1');
    expect(await db.stores.where('cnpj').equals('33333333000133').count()).toBe(0);
    expect((await db.fuelPrices.where('stationId').equals(stationId).toArray()).map((f) => f.notes)).toEqual(expect.arrayContaining([expect.stringMatching(/^ANP .*05\/11\/2026/)]));
    const again = await applyAnpRows(rows);
    expect(again).toMatchObject({ added: 0, stationsCreated: 0 });
    expect(await db.fuelPrices.count()).toBe(3);
  });

  it('posto sem CNPJ já basta para trazer a cidade dele', async () => {
    await savePlace({ segmentId: SEG_COMBUSTIVEL, name: 'Posto da praia', city: 'Joinville', color: '#2a78d6', active: true });
    expect(await applyAnpRows(parseAnpCsv(CSV))).toMatchObject({ added: 1, stationsCreated: 1 });
    expect((await db.stores.where('cnpj').equals('33333333000133').first())?.flag).toBe('Shell');
  });

  it('cidade com mesmo nome em dois estados só entra com o estado confirmado', async () => {
    const dup = CSV + '\nS;PR;JOINVILLE;POSTO DO PARANA LTDA; 55.555.555/0001-55;RUA Z;1;;CENTRO;80000-000;GASOLINA;12/11/2026;6,00;;R$ / litro;BRANCA';
    await savePlace({ segmentId: SEG_COMBUSTIVEL, name: 'Posto', city: 'Joinville', color: '#2a78d6', active: true });
    expect(await applyAnpRows(parseAnpCsv(dup))).toMatchObject({ added: 0, stationsCreated: 0 });
  });

  it('cidade só com mercado não traz postos', async () => {
    await savePlace({ segmentId: SEG_MERCADO, name: 'Mercado', city: 'Criciúma', color: '#2a78d6', active: true });
    expect(await applyAnpRows(parseAnpCsv(CSV))).toMatchObject({ added: 0, stationsCreated: 0 });
    expect(await db.stores.count()).toBe(1);
  });
});
