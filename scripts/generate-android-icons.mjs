/**
 * Gera os ícones e a tela de abertura do app Android a partir de scripts/brand.mjs.
 * Uso: npm run icons:android  (depois de `npx cap add android`)
 */
import { chromium } from 'playwright';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { appIconSvg, symbolParts, NAVY } from './brand.mjs';

const res = new URL('../android/app/src/main/res/', import.meta.url).pathname;
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

/** Símbolo centralizado num quadro de 108dp, dentro da zona segura do ícone adaptável. */
function foregroundSvg(size, scale = 0.56) {
  const s = 512 * scale;
  const off = (512 - s) / 2;
  const k = s / 100;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512"><g transform="translate(${off - 4 * k} ${off}) scale(${k})">${symbolParts()}</g></svg>`;
}

function roundSvg(size) {
  return appIconSvg({ size, rounded: false }).replace(/<rect width="512" height="512" rx="0"/, '<circle cx="256" cy="256" r="256"');
}

const browser = await chromium.launch();
const page = await browser.newPage();
async function png(svg, size, file) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace(/width="\d+" height="\d+"/, `width="${size}" height="${size}"`)}</body></html>`);
  writeFileSync(file, await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } }));
}

for (const [d, f] of Object.entries(DENSITIES)) {
  const dir = `${res}mipmap-${d}/`;
  mkdirSync(dir, { recursive: true });
  await png(appIconSvg({ size: 512 }), Math.round(48 * f), `${dir}ic_launcher.png`);
  await png(roundSvg(512), Math.round(48 * f), `${dir}ic_launcher_round.png`);
  await png(foregroundSvg(512), Math.round(108 * f), `${dir}ic_launcher_foreground.png`);
}

for (const d of readdirSync(res)) {
  if (/^drawable-(port|land)-/.test(d)) rmSync(`${res}${d}`, { recursive: true, force: true });
}
rmSync(`${res}drawable/splash.png`, { force: true });
mkdirSync(`${res}drawable-xxxhdpi`, { recursive: true });
await png(foregroundSvg(512, 0.62), 288, `${res}drawable-xxxhdpi/splash_icon.png`);
writeFileSync(
  `${res}drawable/splash.xml`,
  `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/splash_background" />
    <item>
        <bitmap android:gravity="center" android:src="@drawable/splash_icon" />
    </item>
</layer-list>
`,
);

writeFileSync(
  `${res}values/ic_launcher_background.xml`,
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${NAVY}</color>
    <color name="splash_background">${NAVY}</color>
</resources>
`,
);

await browser.close();
console.log('Ícones Android gerados em', res);
