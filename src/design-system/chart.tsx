import { useEffect, useState, type ReactNode } from 'react';

/** Passo escuro de cada cor da paleta categórica (mesmo matiz, ajustado para o fundo escuro). */
const DARK_STEP: Record<string, string> = {
  '#2a78d6': '#3987e5',
  '#eb6834': '#d95926',
  '#1baf7a': '#199e70',
  '#eda100': '#c98500',
  '#e87ba4': '#d55181',
  '#008300': '#0ca30c',
  '#6250d6': '#9085e9',
  '#e34948': '#e66767',
};

export function useIsDark(): boolean {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

export function useChartTheme() {
  const dark = useIsDark();
  return {
    dark,
    series: (hex: string) => (dark ? (DARK_STEP[hex.toLowerCase()] ?? hex) : hex),
    grid: dark ? '#25354D' : '#E5EAF0',
    axis: dark ? '#94A3B8' : '#64738A',
    surface: dark ? '#111C2E' : '#FFFFFF',
    primary: dark ? '#3987e5' : '#2a78d6',
  };
}

const axisNumber = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 2 });
/** Rótulo curto de eixo em reais (ex.: "R$ 28", "R$ 1,2 mil"), sem quebrar linha. */
export const axisMoney = (v: number) => `R$\u00a0${axisNumber.format(v)}`;

export function ChartTooltip({ title, rows }: { title: ReactNode; rows: { color?: string; label: string; value: string }[] }) {
  return (
    <div className="min-w-[160px] rounded-md border border-line bg-raised px-3 py-2 text-xs shadow-float">
      <div className="mb-1 font-semibold text-ink">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 py-0.5">
          {r.color && <span className="h-2 w-2 rounded-full" style={{ background: r.color }} aria-hidden />}
          <span className="flex-1 text-muted">{r.label}</span>
          <span className="price font-bold text-ink">{r.value}</span>
        </div>
      ))}
    </div>
  );
}
