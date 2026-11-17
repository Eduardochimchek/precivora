/** Páginas de consulta de NFC-e no layout nacional, com dados inventados. */

const KEY = '4226 1112 3456 7800 0190 6500 1000 0012 3410 0001 2345';

const item = (name: string, code: string, qty: string, un: string, unit: string, total: string, i: number) => `
  <tr id="Item + ${i}">
    <td valign="top"><span class="txtTit">${name}</span><span class="RCod">(Código: ${code} )</span><br />
      <span class="Rqtd"><strong>Qtde.:</strong>${qty}</span><span class="RUN"><strong>UN: </strong>${un}</span>
      <span class="RvlUnit"><strong>Vl. Unit.:</strong>&nbsp;${unit}</span></td>
    <td align="right" valign="top" class="txtTit noWrap">Vl. Total<br /><span class="valor">${total}</span></td>
  </tr>`;

const page = (store: string, cnpj: string, address: string, rows: string, total: string, key = KEY) => `<!DOCTYPE html>
<html><head><title>Consulta Pública de NFCe</title></head><body>
<div id="conteudo">
  <div class="txtCenter">
    <div id="u20" class="txtTopo">${store}</div>
    <div class="text">CNPJ: ${cnpj}</div>
    <div class="text">${address}</div>
  </div>
  <table id="tabResult">${rows}</table>
  <div id="totalNota">
    <div id="linhaTotal"><label>Qtd. total de itens:</label><span class="totalNumb">3</span></div>
    <div id="linhaTotal" class="linhaShade"><label>Valor a pagar R$:</label><span class="totalNumb txtMax">${total}</span></div>
  </div>
  <div id="infos">
    <ul><li><strong>Número: </strong>4321<strong> Série: </strong>1<strong> Emissão: </strong>14/11/2026 18:42:10 - Via Consumidor</li></ul>
    <h4>Chave de acesso</h4><span class="chave">${key}</span>
  </div>
</div></body></html>`;

export const MARKET_RECEIPT = page(
  'MERCADO EXEMPLO DO BAIRRO LTDA',
  '12.345.678/0001-90',
  'RUA DAS FLORES , 100 , , CENTRO , JOINVILLE , SC',
  [
    item('ARROZ TIPO 1 BOM GRAO 5KG', '7891', '2', 'UN', '24,90', '49,80', 1),
    item('BANANA PRATA KG', '210', '1,235', 'KG', '6,99', '8,63', 2),
    item('LEITE INTEGRAL CAMPO 1L', '7892', '6', 'UN', '4,79', '28,74', 3),
  ].join(''),
  '87,17',
);

export const FUEL_RECEIPT = page(
  'POSTO EXEMPLO COMBUSTIVEIS LTDA',
  '98.765.432/0001-10',
  'AV BEIRA MAR , 2000 , , CENTRO , FLORIANOPOLIS , SC',
  item('GASOLINA C COMUM', '1', '30,512', 'L', '6,49', '198,02', 1),
  '198,02',
  '4226 1198 7654 3200 0110 6500 1000 0099 8810 0009 9887',
);

/** Mesmo conteúdo, mas sem as classes do layout (para o leitor por texto). */
export const PLAIN_RECEIPT = `<html><body><p>MERCADO SEM CLASSES LTDA</p><p>CNPJ: 11.222.333/0001-44</p>
<p>RUA A , 1 , , CENTRO , BLUMENAU , SC</p>
<p>CAFE TORRADO 500G (Código: 55 ) Qtde.:1 UN: UN Vl. Unit.: 17,49 Vl. Total 17,49</p>
<p>ACUCAR CRISTAL 1KG (Código: 56 ) Qtde.:2 UN: UN Vl. Unit.: 4,99 Vl. Total 9,98</p>
<p>Valor a pagar R$: 27,47</p><p>Emissão: 01/11/2026 09:15:00</p>
<p>Chave de acesso: 4226 1111 2223 3300 0144 6500 1000 0055 5510 0005 5555</p></body></html>`;

export const SECURITY_PAGE = `<html><body><h1>Validação de segurança</h1><p>Efetue a validação de segurança.</p><button>Validar</button></body></html>`;
