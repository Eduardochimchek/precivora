import { chromium } from 'playwright';
import { appIconSvg, symbolSvg, wordmarkSvg, NAVY, PAPER } from './brand.mjs';
const out = process.argv[2];
const html = `<html><body style="margin:0;padding:24px;background:#ccd;display:flex;gap:24px;flex-wrap:wrap;align-items:center">
<div style="width:256px">${appIconSvg({ size: 256 })}</div>
<div style="width:48px">${appIconSvg({ size: 48 })}</div>
<div style="width:24px">${appIconSvg({ size: 24 })}</div>
<div style="width:120px;background:${PAPER};padding:8px">${symbolSvg({ fg: NAVY, accent: '#4D7C0F' })}</div>
<div style="width:380px;background:#fff">${wordmarkSvg()}</div>
<div style="width:380px;background:${NAVY}">${wordmarkSvg({ ink: PAPER, fg: PAPER, accent: '#A3E635' })}</div>
</body></html>`;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 420 } });
await p.setContent(html);
await p.screenshot({ path: out });
await b.close();
