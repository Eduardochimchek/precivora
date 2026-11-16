/**
 * Gera todos os ativos de marca a partir de scripts/brand.mjs.
 * Uso: npm run icons  (usa o Chromium do Playwright para rasterizar os SVGs)
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { appIconSvg, monochromeSvg, symbolSvg, wordmarkSvg, NAVY, PAPER, LIME } from './brand.mjs';

const pub = new URL('../public/', import.meta.url).pathname;
mkdirSync(`${pub}icons`, { recursive: true });
mkdirSync(`${pub}brand`, { recursive: true });

const font = readFileSync(
  new URL('../node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2', import.meta.url),
).toString('base64');
const withFont = (svg) =>
  svg.replace(
    /(<svg[^>]*>)/,
    `$1<style>@font-face{font-family:'Bricolage Grotesque';font-weight:200 800;src:url(data:font/woff2;base64,${font}) format('woff2');}</style>`,
  );

const write = (name, content) => writeFileSync(`${pub}${name}`, content);

write('favicon.svg', appIconSvg({ size: 64 }));
write('icons/monochrome.svg', monochromeSvg());
write('brand/symbol-on-light.svg', symbolSvg({ fg: NAVY, accent: '#4D7C0F' }));
write('brand/symbol-on-dark.svg', symbolSvg({ fg: PAPER, accent: LIME }));
write('brand/symbol-mono.svg', monochromeSvg());
write('brand/app-icon.svg', appIconSvg({ size: 512 }));
write('brand/logo-horizontal-light.svg', withFont(wordmarkSvg()));
write('brand/logo-horizontal-dark.svg', withFont(wordmarkSvg({ ink: PAPER, fg: PAPER, accent: LIME, bg: NAVY })));
write('brand/logo-horizontal-mono.svg', withFont(wordmarkSvg({ ink: '#000', fg: '#000', accent: '#000' })));

const browser = await chromium.launch();
const page = await browser.newPage();

async function png(svg, size, file) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${svg.replace(/width="\d+" height="\d+"/, `width="${size}" height="${size}"`)}</body></html>`,
  );
  const buf = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  if (file) writeFileSync(`${pub}${file}`, buf);
  return buf;
}

await png(appIconSvg({ size: 192 }), 192, 'icons/icon-192.png');
await png(appIconSvg({ size: 512 }), 512, 'icons/icon-512.png');
await png(appIconSvg({ size: 512, rounded: false, safe: true }), 512, 'icons/maskable-512.png');
await png(appIconSvg({ size: 1024, rounded: false }), 1024, 'icons/android-1024.png');
await png(appIconSvg({ size: 180, rounded: false }), 180, 'apple-touch-icon.png');
const ico16 = await png(appIconSvg({ size: 16 }), 16);
const ico32 = await png(appIconSvg({ size: 32 }), 32);
const ico48 = await png(appIconSvg({ size: 48 }), 48);

// favicon.ico com PNGs embutidos (formato ICO aceita PNG desde o Vista)
const images = [ [16, ico16], [32, ico32], [48, ico48] ];
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(images.length, 4);
let offset = 6 + 16 * images.length;
const entries = images.map(([s, buf]) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(s, 0); e.writeUInt8(s, 1); e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
  e.writeUInt32LE(buf.length, 8); e.writeUInt32LE(offset, 12);
  offset += buf.length;
  return e;
});
write('favicon.ico', Buffer.concat([header, ...entries, ...images.map(([, b]) => b)]));

// Imagem social (Open Graph) 1200x630
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(`<html><body style="margin:0;width:1200px;height:630px;background:${NAVY};display:flex;align-items:center;padding:0 96px;box-sizing:border-box">
<div style="width:820px">${withFont(wordmarkSvg({ ink: PAPER, fg: PAPER, accent: LIME }))}
<div style="font:600 34px 'Bricolage Grotesque',system-ui;color:#94A3B8;margin:18px 0 0 104px">Sua economia começa aqui.</div></div></body></html>`);
await page.waitForTimeout(200);
writeFileSync(`${pub}og-image.png`, await page.screenshot());

await browser.close();
console.log('Ícones gerados em public/');
