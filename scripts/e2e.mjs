/**
 * Teste ponta a ponta no build de produção (vite preview + Chromium do Playwright).
 * Uso: npm run build && npm run test:e2e   (SCREENSHOTS=<pasta> para salvar as capturas)
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { buildSampleBackup } from './fixtures/sample-backup.mjs';

const PORT = 4317;
const BASE = `http://localhost:${PORT}/`;
const SHOTS = process.env.SCREENSHOTS || join(process.cwd(), 'screenshots');
mkdirSync(SHOTS, { recursive: true });

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
process.on('exit', () => server.kill());
for (let i = 0; ; i++) {
  try {
    if ((await fetch(BASE)).ok) break;
  } catch {
    /* ainda subindo */
  }
  if (i > 100) throw new Error('preview não subiu');
  await new Promise((r) => setTimeout(r, 200));
}

let failures = 0;
let page;
const results = [];
async function pickPlace(page, name, label = 'Lugar') {
  await page.getByLabel(label, { exact: true }).click();
  const dialog = page.getByRole('dialog', { name: label === 'Posto' ? 'Escolher posto' : 'Escolher lugar' });
  await dialog.getByRole('button', { name: new RegExp(name) }).first().click();
  await dialog.waitFor({ state: 'detached' }).catch(() => {});
}

async function step(name, fn) {
  try {
    await fn();
    results.push(`  ✓ ${name}`);
  } catch (e) {
    failures++;
    await page?.screenshot({ path: join(SHOTS, `falha-${failures}.png`) }).catch(() => {});
    results.push(`  ✗ ${name}\n      ${String(e.message).split('\n')[0]}`);
  }
}
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const browser = await chromium.launch();
const errors = [];
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'pt-BR', colorScheme: 'light' });
page = await mobile.newPage();
page.setDefaultTimeout(10000);
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));
const SHOT_STYLE = '[data-toasts], div.fixed[role="status"]{visibility:hidden!important}';
const shot = (name, fullPage = true) => page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage, style: SHOT_STYLE });
const go = async (hash) => {
  await page.goto(`${BASE}#${hash}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(250);
};

try {
  await step('primeira abertura: boas-vindas, nome uma vez e apresentação guiada', async () => {
    await page.goto(BASE);
    await page.waitForSelector('text=Descubra onde comprar e quanto economizar.', { timeout: 10000 });
    await page.waitForSelector('#splash', { state: 'detached', timeout: 5000 });
    const meta = await page.getAttribute('meta[name="theme-color"]', 'content');
    assert(meta === '#F7F9FC', `theme-color claro esperado, veio ${meta}`);
    await shot('01-boas-vindas', false);
    await page.getByRole('button', { name: 'Começar' }).click();
    await page.getByLabel('Seu nome (opcional)').fill('Ana');
    await page.getByRole('button', { name: 'Continuar' }).click();
    const tour = page.getByRole('dialog', { name: 'Registre os preços' });
    await tour.waitFor();
    await page.waitForTimeout(400);
    await shot('01b-tour', false);
    const seen = [];
    for (let i = 0; i < 6; i++) {
      await page.getByRole('button', { name: 'Próximo' }).click();
      await page.waitForTimeout(250);
      seen.push(await page.evaluate(() => location.hash));
    }
    assert(seen.includes('#/listas') && seen.includes('#/historico') && seen.includes('#/mais'), `tour não passou pelas telas: ${seen.join(' ')}`);
    await page.getByRole('button', { name: 'Começar a usar' }).click();
    await page.waitForSelector('text=Primeiros passos');
    assert((await page.locator('h1').first().innerText()).includes('Ana'), 'saudação sem o nome');
    await page.reload();
    await page.waitForSelector('text=Primeiros passos');
    assert((await page.locator('text=Descubra onde comprar e quanto economizar.').count()) === 0, 'boas-vindas apareceram de novo');
    await shot('01c-inicio-vazio');
  });

  await step('cadastra lugar (tipo Mercado) pela interface', async () => {
    await page.getByRole('button', { name: 'Cadastrar um lugar' }).click();
    assert((await page.getByRole('radio', { name: 'Mercado' }).getAttribute('aria-checked')) === 'true', 'tipo Mercado não veio marcado');
    await page.getByLabel('Nome').fill('Mercado Teste');
    await page.getByLabel('Bairro (opcional)').fill('Centro');
    await page.getByRole('button', { name: 'Cadastrar', exact: true }).click();
    await page.waitForSelector('text=Lugar cadastrado');
  });

  await step('cadastra produto com marca e embalagem', async () => {
    await page.getByRole('button', { name: 'Atalhos' }).count().catch(() => 0);
    await page.getByRole('button', { name: 'Produto', exact: true }).click();
    await page.getByLabel('Nome', { exact: true }).fill('Açúcar refinado');
    await page.getByRole('button', { name: /Mais detalhes/ }).click();
    await page.getByLabel('Marca (opcional)').fill('Doce Lar');
    await page.getByLabel('Conteúdo da embalagem').fill('2');
    await page.getByLabel('Unidade', { exact: true }).selectOption('kg');
    await shot('02-form-produto');
    await page.getByRole('button', { name: 'Cadastrar produto' }).click();
    await page.waitForSelector('text=Produto cadastrado');
  });

  await step('registra preço e mostra variação contra o último', async () => {
    await page.getByRole('button', { name: 'Registrar preço' }).first().click();
    await page.getByRole('combobox', { name: 'Produto' }).fill('acucar');
    await page.getByRole('option', { name: /Açúcar refinado/ }).click();
    await pickPlace(page, 'Mercado Teste');
    await page.getByLabel('Preço', { exact: true }).fill('9,98');
    await page.getByRole('button', { name: 'Salvar preço' }).click();
    await page.waitForSelector('text=Preço registrado');
    await page.getByRole('button', { name: 'Registrar preço' }).first().click();
    await page.getByRole('combobox', { name: 'Produto' }).fill('açúcar');
    await page.getByRole('option', { name: /Açúcar refinado/ }).click();
    await pickPlace(page, 'Mercado Teste');
    await page.getByLabel('Preço', { exact: true }).fill('8,98');
    await page.waitForSelector('text=Último preço');
    const txt = (await page.locator('form#price-form').innerText()).replace(/\u00a0/g, ' ');
    assert(txt.includes('R$ 4,49/kg'), 'preço por kg não apareceu: ' + txt.slice(0, 200));
    assert(/-10,0?2%/.test(txt), 'variação -10,02% não apareceu');
    await shot('03-registro-preco');
    await page.getByRole('button', { name: 'Salvar preço' }).click();
    await page.waitForSelector('text=Preço registrado');
  });

  await step('dados persistem após recarregar', async () => {
    await page.reload();
    await page.waitForSelector('text=Últimos preços');
    assert(await page.locator('text=Açúcar refinado').first().isVisible(), 'produto sumiu após reload');
  });

  await step('importa backup de demonstração (mesclar) com resumo', async () => {
    const file = join(tmpdir(), 'precivora-demo-backup.json');
    writeFileSync(file, JSON.stringify(buildSampleBackup()));
    await go('/backup');
    await page.locator('#backup-file').setInputFiles(file);
    await page.waitForSelector('text=Arquivo válido');
    await shot('04-backup-resumo');
    await page.getByRole('button', { name: /Importar \d+ registros/ }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Mesclar' }).click();
    await page.waitForSelector('text=registros adicionados');
    // reimportar o mesmo arquivo não duplica
    await page.locator('#backup-file').setInputFiles(file);
    await page.waitForSelector('text=Nada novo para importar');
  });

  await step('rejeita arquivo inválido sem alterar dados', async () => {
    const bad = join(tmpdir(), 'precivora-ruim.json');
    writeFileSync(bad, JSON.stringify({ app: 'outro', data: {} }));
    await page.locator('#backup-file').setInputFiles(bad);
    await page.waitForSelector('text=Não dá para importar este arquivo');
  });

  await step('exporta backup JSON válido', async () => {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar backup' }).click()]);
    const path = await dl.path();
    const json = JSON.parse(readFileSync(path, 'utf8'));
    assert(json.app === 'precivora' && json.data.products.length >= 8, 'backup exportado incompleto');
    assert(dl.suggestedFilename().startsWith('precivora-backup-'), 'nome do arquivo inesperado');
  });

  await step('celular: "Enviar backup" abre o compartilhamento com o arquivo', async () => {
    const p2 = await mobile.newPage();
    p2.setDefaultTimeout(10000);
    await p2.addInitScript(() => {
      window.__shared = null;
      navigator.canShare = (data) => Array.isArray(data?.files) && data.files.length > 0;
      navigator.share = async (data) => {
        const f = data.files[0];
        window.__shared = { name: f.name, type: f.type, text: await f.text() };
      };
    });
    await p2.goto(`${BASE}#/backup`);
    await p2.getByRole('button', { name: 'Enviar backup' }).click();
    await p2.waitForFunction(() => window.__shared !== null);
    const shared = await p2.evaluate(() => window.__shared);
    assert(shared.name.startsWith('precivora-backup-') && shared.type === 'application/json', 'arquivo compartilhado inesperado');
    assert(JSON.parse(shared.text).data.products.length >= 8, 'backup compartilhado incompleto');
    await p2.waitForSelector('text=Backup enviado');
    await p2.getByRole('heading', { name: 'Trocar de celular' }).waitFor();
    await p2.close();
  });

  await step('cadastro genérico: item só com nome, tipo novo e lugar dele', async () => {
    await go('/tipos');
    await page.getByRole('button', { name: 'Novo', exact: true }).click();
    await page.getByLabel('Nome').fill('Pet shop');
    await page.getByRole('radio', { name: 'Pet' }).click();
    await page.getByRole('button', { name: 'Salvar' }).click();
    await page.waitForSelector('text=Tipo criado');
    await go('/lugares');
    await page.getByRole('button', { name: 'Novo', exact: true }).click();
    await page.getByRole('radio', { name: 'Pet shop' }).click();
    await page.getByLabel('Nome').fill('Pet do Bairro');
    await page.getByRole('button', { name: 'Cadastrar', exact: true }).click();
    await page.waitForSelector('text=Lugar cadastrado');
    await go('/produtos');
    await page.getByRole('button', { name: 'Novo', exact: true }).click();
    await page.getByLabel('Nome', { exact: true }).fill('Ração 10 kg');
    await page.getByRole('radio', { name: 'Pet shop' }).click();
    await page.getByRole('button', { name: 'Cadastrar produto' }).click();
    await page.waitForSelector('text=Produto cadastrado');
    await page.getByRole('link', { name: /Ração 10 kg/ }).click();
    await page.getByRole('button', { name: 'Registrar preço' }).first().click();
    await pickPlace(page, 'Pet do Bairro');
    await page.getByLabel('Preço', { exact: true }).fill('149,90');
    await page.getByRole('button', { name: 'Salvar preço' }).click();
    await page.waitForSelector('text=Preço registrado');
    await go('/comparar');
    await page.getByRole('tab', { name: 'Pet shop' }).click();
    await page.waitForSelector('text=Ração 10 kg');
    const txt = (await page.locator('main').innerText()).replace(/\u00a0/g, ' ');
    assert(!txt.includes('Arroz'), 'filtro por tipo mostrou itens de outro tipo');
    assert(txt.includes('R$ 149,90'), 'preço do item genérico não apareceu');
    await shot('18-comparar-pet');
  });

  await step('comparador filtra Farmácia', async () => {
    await go('/comparar?tipo=seg-farmacia');
    await page.waitForSelector('text=Dipirona');
    const txt = await page.locator('main').innerText();
    assert(!txt.includes('Feijão'), 'itens de mercado apareceram no filtro Farmácia');
    await shot('19-comparar-farmacia');
  });

  await step('define orçamento pela interface', async () => {
    await go('/orcamento');
    await page.getByLabel('Orçamento mensal', { exact: true }).fill('900');
    await page.getByLabel('Meta de economia', { exact: true }).fill('60');
    await page.getByRole('button', { name: 'Salvar metas' }).click();
    await page.waitForSelector('text=Metas salvas');
    await shot('10-orcamento');
  });

  await step('registra compra pela interface e gera preço confirmado', async () => {
    await go('/compras/nova');
    await pickPlace(page, 'Mercado Teste');
    await page.getByRole('combobox', { name: 'Adicionar produto' }).fill('açúcar');
    await page.getByRole('option', { name: /Açúcar refinado/ }).click();
    const unit = page.getByLabel('Preço unit.');
    assert((await unit.inputValue()) === '8,98', 'preço unitário não veio do último registro');
    await page.getByLabel('Qtd.').fill('2');
    const total = (await page.locator('main').innerText()).replace(/\u00a0/g, ' ');
    assert(total.includes('R$ 17,96'), 'total da compra errado');
    await page.getByRole('button', { name: 'Registrar compra' }).click();
    await page.waitForSelector('text=Compra registrada');
    await page.waitForSelector('text=Mercado Teste');
  });

  await step('dashboard com dados reais', async () => {
    await go('/');
    await page.waitForSelector('text=Economia estimada');
    await page.waitForSelector('text=Oportunidades');
    await shot('05-inicio', false);
  });

  await step('comparador: busca "arroz" com sugestões explicadas', async () => {
    await go('/comparar?q=arroz');
    await page.waitForSelector('text=Melhores escolhas para');
    const first = await page.locator('section[aria-labelledby="sugestoes"] li').first().innerText();
    assert(first.includes('Grão Fino'), 'Arroz Grão Fino (nota 5) deveria ser a 1ª sugestão: ' + first);
    await shot('06-comparar-arroz', false);
  });

  await step('ficha do produto com estatísticas e gráfico', async () => {
    await page.locator('section[aria-labelledby="sugestoes"] li a').first().click();
    await page.waitForSelector('text=Por lugar');
    await page.waitForSelector('.recharts-surface');
    await shot('07-produto');
  });

  await step('combustíveis: ranking, economia por tanque e flex', async () => {
    await go('/combustiveis?f=gasolina_comum');
    await page.waitForSelector('text=Quanto você economiza');
    const txt = (await page.locator('main').innerText()).replace(/\u00a0/g, ' ');
    assert(txt.includes('R$ 6,050'), 'menor gasolina R$ 6,050 não apareceu');
    assert(txt.includes('R$ 9,60'), 'economia em 40 L (R$ 9,60) não apareceu');
    assert(/Etanol compensa|Gasolina compensa|Tanto faz/.test(txt), 'calculadora flex sem resultado');
    await shot('08-combustiveis');
  });

  await step('combustível: escolhe o posto pela busca e salva o preço', async () => {
    await go('/combustiveis?f=gasolina_comum');
    await page.getByRole('button', { name: 'Preço', exact: true }).click();
    await page.getByLabel('Posto', { exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Escolher posto' });
    await dialog.getByLabel('Buscar lugar').fill('trevo');
    await dialog.getByRole('button', { name: /Posto Trevo/ }).click();
    await page.getByLabel('Preço por L').fill('5,999');
    await page.getByRole('button', { name: 'Salvar preço' }).click();
    await page.waitForSelector('text=Posto Trevo');
    const txt = (await page.locator('main').innerText()).replace(/\u00a0/g, ' ');
    assert(txt.includes('R$ 5,999'), 'preço novo no Posto Trevo não apareceu no ranking');
  });

  await step('perto de mim: posto sem preço aparece para anotar e posto fora do mapa é avisado', async () => {
    await mobile.grantPermissions(['geolocation']);
    await mobile.setGeolocation({ latitude: -28.68, longitude: -49.37 });
    await go('/lugares');
    await page.getByRole('button', { name: 'Novo', exact: true }).click();
    await page.getByRole('radio', { name: 'Combustível' }).click();
    await page.getByLabel('Nome', { exact: true }).fill('Posto Sem Preço');
    await page.getByRole('button', { name: 'Cadastrar', exact: true }).click();
    await page.waitForSelector('text=Lugar cadastrado');
    await page.evaluate(
      () =>
        new Promise((res, rej) => {
          const req = indexedDB.open('precivora');
          req.onerror = () => rej(String(req.error));
          req.onsuccess = () => {
            const tx = req.result.transaction('stores', 'readwrite');
            const os = tx.objectStore('stores');
            const all = os.getAll();
            all.onsuccess = () => {
              all.result.forEach((s, i) => {
                if (s.name === 'Posto Trevo') os.put({ ...s, lat: undefined, lng: undefined, geo: undefined });
                else os.put({ ...s, lat: -28.68 + i * 0.001, lng: -49.37, geo: 'street' });
              });
            };
            tx.oncomplete = () => res(undefined);
          };
        }),
    );
    await page.reload();
    await go('/combustiveis?f=gasolina_comum');
    await page.getByRole('button', { name: 'até 5 km' }).click();
    const sec = page.locator('section', { has: page.getByRole('heading', { name: /Perto, sem preço de gasolina/ }) });
    await sec.waitFor();
    assert(await sec.getByText('Posto Sem Preço').isVisible(), 'posto sem preço não apareceu na lista de perto');
    const note = await page.getByRole('note').innerText();
    assert(/1 posto com preço ainda não está no mapa/.test(note), `aviso de posto fora do mapa errado: ${note}`);
    await shot('08b-perto-sem-preco');
    await sec.getByRole('button', { name: 'Anotar preço no Posto Sem Preço' }).click();
    assert((await page.getByLabel('Posto', { exact: true }).innerText()).includes('Posto Sem Preço'), 'formulário não veio com o posto escolhido');
    await page.getByLabel('Preço por L').fill('6,111');
    await page.getByRole('button', { name: 'Salvar preço' }).click();
    await page.waitForSelector('text=R$ 6,111');
    assert(!(await page.getByRole('heading', { name: /Perto, sem preço de gasolina/ }).isVisible().catch(() => false)), 'posto continuou na lista sem preço depois de anotar');
    await mobile.clearPermissions();
  });

  await step('endereço inválido não quebra a tela e o erro não trava o app', async () => {
    for (const r of ['/combustiveis?f=lixo', '/mapa?f=lixo&tipo=nada&lugar=xyz', '/produtos/nao-existe', '/lugares?tipo=nada&fav=1', '/comparar?q=%28%28%28']) {
      await go(r);
      const t = await page.locator('main').innerText();
      assert(!t.includes('Algo deu errado'), `${r} quebrou a tela`);
    }
  });

  await step('sem rolagem horizontal em 360 px', async () => {
    await page.setViewportSize({ width: 360, height: 760 });
    for (const r of ['/', '/historico', '/comparar', '/combustiveis', '/lugares', '/listas', '/compras/nova', '/mais']) {
      await go(r);
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      assert(sw <= 361, `${r} vaza para o lado em 360 px (largura ${sw})`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
  });

  await step('lista: compara mercados e recomenda', async () => {
    await go('/listas');
    await page.getByRole('link', { name: /Compra do mês/ }).click();
    await page.waitForSelector('text=Onde comprar');
    const txt = await page.locator('main').innerText();
    assert(/Melhor lugar único|Compra dividida/.test(txt), 'sem recomendação');
    await page.getByRole('checkbox').first().click();
    await shot('09-lista', false);
  });

  await step('histórico com gráfico e categorias', async () => {
    await go('/historico');
    await page.waitForSelector('text=Gasto por mês');
    await page.waitForSelector('.recharts-surface');
    await shot('11-historico', false);
  });

  for (const [hash, name, text] of [
    ['/mais', '12-mais', 'Cadastros'],
    ['/avaliacoes', '13-avaliacoes', 'Rende bem'],
    ['/marcas', '14-marcas', 'Grão Fino'],
    ['/mercados', '15-lugares-mercado', 'Atacarejo Rota 5'],
    ['/lugares', '15b-lugares', 'Drogaria Central'],
    ['/tipos', '15c-tipos', 'Farmácia'],
    ['/ajustes', '16-ajustes', 'Privacidade'],
    ['/compras/nova', '17-nova-compra', 'Nova compra'],
  ]) {
    await step(`tela ${hash} abre`, async () => {
      await go(hash);
      await page.waitForSelector(`text=${text}`);
      await shot(name);
    });
  }

  await step('tema escuro manual atualiza theme-color', async () => {
    await go('/ajustes');
    await page.getByRole('radio', { name: 'Escuro' }).click();
    await page.waitForTimeout(400);
    const meta = await page.getAttribute('meta[name="theme-color"]', 'content');
    assert(meta === '#0B1220', `theme-color escuro esperado, veio ${meta}`);
    assert(await page.evaluate(() => document.documentElement.classList.contains('dark')), 'classe dark ausente');
    await go('/');
    await shot('20-inicio-escuro');
    await go('/comparar?q=arroz');
    await page.waitForSelector('text=Melhores escolhas para');
    await shot('21-comparar-escuro');
    await go('/combustiveis');
    await shot('22-combustiveis-escuro', false);
    await page.reload();
    assert(await page.evaluate(() => document.documentElement.classList.contains('dark')), 'tema escuro não persistiu');
    await go('/ajustes');
    await page.getByRole('radio', { name: 'Automático' }).click();
  });

  await step('funciona offline depois do primeiro acesso', async () => {
    await page.goto(BASE);
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return !!reg.active;
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await mobile.setOffline(true);
    await page.reload();
    await page.waitForSelector('text=Economia estimada', { timeout: 10000 });
    await go('/historico');
    await page.waitForSelector('text=Gasto por mês', { timeout: 10000 });
    await mobile.setOffline(false);
  });

  await step('confirmação personalizada ao excluir (sem confirm nativo)', async () => {
    let native = false;
    page.on('dialog', (d) => {
      native = true;
      void d.dismiss();
    });
    await go('/listas');
    await page.getByRole('link', { name: /Compra do mês/ }).click();
    await page.getByRole('button', { name: 'Excluir', exact: true }).click();
    await page.waitForSelector('role=alertdialog');
    await page.keyboard.press('Escape');
    assert(!native, 'usou diálogo nativo');
    assert((await page.locator('role=alertdialog').count()) === 0, 'Esc não fechou o diálogo');
  });

  const desktop = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'pt-BR', colorScheme: 'dark' });
  await step('layout desktop (navegação lateral) e tema automático escuro', async () => {
    const d = await desktop.newPage();
    d.on('pageerror', (e) => errors.push(e.message));
    await d.goto(BASE);
    await d.waitForSelector('text=Descubra onde comprar e quanto economizar.');
    assert(await d.evaluate(() => document.documentElement.classList.contains('dark')), 'tema automático não seguiu o sistema');
    await d.screenshot({ path: join(SHOTS, '30-desktop-boas-vindas-escuro.png') });
    await d.getByRole('button', { name: 'Já tenho um backup' }).click();
    await d.waitForSelector('text=Trocar de celular');
    assert(await d.locator('aside nav').isVisible(), 'navegação lateral não visível');
    const file = join(tmpdir(), 'precivora-demo-backup.json');
    await d.goto(`${BASE}#/backup`);
    await d.getByRole('radio', { name: 'Substituir tudo' }).click();
    await d.locator('#backup-file').setInputFiles(file);
    await d.getByRole('button', { name: 'Substituir pelos dados do backup' }).click();
    await d.getByRole('alertdialog').getByRole('button', { name: 'Substituir tudo' }).click();
    await d.waitForSelector('text=Backup restaurado');
    await d.goto(`${BASE}#/`);
    await d.waitForSelector('text=Oportunidades');
    await d.waitForTimeout(300);
    await d.screenshot({ path: join(SHOTS, '31-desktop-inicio.png'), style: SHOT_STYLE });
    await d.goto(`${BASE}#/listas`);
    await d.getByRole('link', { name: /Compra do mês/ }).click();
    await d.waitForSelector('text=Onde comprar');
    await d.screenshot({ path: join(SHOTS, '32-desktop-lista.png'), fullPage: true, style: SHOT_STYLE });
  });

  await step('sem erros no console', async () => {
    const real = errors.filter((e) => !/net::ERR_INTERNET_DISCONNECTED|Failed to fetch/.test(e));
    assert(real.length === 0, real.join(' | '));
  });
} finally {
  await browser.close();
  server.kill();
}

console.log(results.join('\n'));
console.log(failures ? `\n${failures} falha(s)` : '\nTodos os fluxos passaram');
console.log(`Capturas em ${SHOTS}`);
process.exit(failures ? 1 : 0);
