export const NAVY = '#101C2C';
export const BLUE = '#1D3557';
export const LIME = '#A3E635';
export const PAPER = '#F7F9FC';

/** Símbolo Precivora em grade 100x100: haste do P + etiqueta (barriga do P, ilhós = miolo) + seta de queda de preço. */
export function symbolParts({ fg = PAPER, accent = LIME, holeFill = null } = {}) {
  const tag = `M27 16 H58 a6 6 0 0 1 4.3 1.8 L79.5 35.5 a6 6 0 0 1 0 8.4 L62.3 61.6 a6 6 0 0 1 -4.3 1.8 H41 V76 a8 8 0 0 1 -8 8 h-0 a8 8 0 0 1 -8 -8 V24 a8 8 0 0 1 8 -8 Z`;
  const hole = `M63.5 39.7 m-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 Z`;
  const arrow = `M50 70 L60 80 L68 72 L80 84`;
  const head = `M70 84 H80 V74`;
  const body = holeFill
    ? `<path d="${tag}" fill="${fg}"/><path d="${hole}" fill="${holeFill}"/>`
    : `<path d="${tag} ${hole}" fill="${fg}" fill-rule="evenodd"/>`;
  return `${body}<path d="${arrow}" fill="none" stroke="${accent}" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/><path d="${head}" fill="none" stroke="${accent}" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>`;
}

export function symbolSvg(opts = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 8 80 84" role="img" aria-label="Precivora">${symbolParts(opts)}</svg>`;
}

/** Ícone quadrado: fundo azul-marinho; `safe` reduz o símbolo para a zona segura de ícones maskable. */
export function appIconSvg({ size = 512, rounded = true, safe = false } = {}) {
  const r = rounded ? 112 : 0;
  const scale = safe ? 0.62 : 0.78;
  const s = 512 * scale;
  const off = (512 - s) / 2;
  const k = s / 100;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16263C"/><stop offset="1" stop-color="${NAVY}"/></linearGradient></defs>
<rect width="512" height="512" rx="${r}" fill="url(#g)"/>
<g transform="translate(${off - 4 * k} ${off}) scale(${k})">${symbolParts()}</g>
</svg>`;
}

export function monochromeSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 8 80 84">${symbolParts({ fg: '#000', accent: '#000' })}</svg>`;
}

export function wordmarkSvg({ ink = NAVY, fg = NAVY, accent = '#4D7C0F', bg = null } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 100" role="img" aria-label="Precivora">
${bg ? `<rect width="420" height="100" rx="20" fill="${bg}"/>` : ''}
<g transform="translate(6 4) scale(0.92)">${symbolParts({ fg, accent })}</g>
<text x="104" y="68" font-family="'Bricolage Grotesque','Bricolage Grotesque Variable',system-ui,sans-serif" font-size="54" font-weight="700" letter-spacing="-1.6" fill="${ink}">precivora</text>
</svg>`;
}
