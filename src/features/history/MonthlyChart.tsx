import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartTooltip, axisMoney, useChartTheme } from '@/design-system';
import { money } from '@/utils/format';

export function MonthlyChart({ data }: { data: { key: string; label: string; total: number }[] }) {
  const t = useChartTheme();
  return (
    <figure>
      <figcaption className="sr-only">Gasto por mês: {data.map((d) => `${d.label} ${money(d.total)}`).join('; ')}</figcaption>
      <div className="h-52 w-full">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke={t.grid} />
            <XAxis dataKey="label" tick={{ fill: t.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis width={64} tick={{ fill: t.axis, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={axisMoney} />
            <Tooltip
              cursor={{ fill: t.grid, opacity: 0.5 }}
              content={({ active, payload }) =>
                active && payload?.length ? <ChartTooltip title={payload[0].payload.label} rows={[{ label: 'Gasto', value: money(Number(payload[0].value)) }]} /> : null
              }
            />
            <Bar dataKey="total" fill={t.primary} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
