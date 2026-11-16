import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartTooltip, axisMoney, useChartTheme } from '@/design-system';
import type { ID, PriceRecord, Product, Store } from '@/types';
import { packagePrice } from '@/services/units';
import { formatDate, formatShort } from '@/utils/date';
import { money } from '@/utils/format';

/** Preço da embalagem ao longo do tempo, uma linha por lugar (cor = cor do lugar). */
export function PriceHistoryChart({ records, stores }: { product: Product; records: PriceRecord[]; stores: Map<ID, Store> }) {
  const theme = useChartTheme();
  const storeIds = [...new Set(records.map((r) => r.storeId))].slice(0, 8);
  const days = [...new Set(records.map((r) => r.date.slice(0, 10)))].sort();
  const data = days.map((d) => {
    const row: Record<string, number | string> = { d, t: new Date(d + 'T12:00:00').getTime() };
    for (const s of storeIds) {
      const rs = records.filter((r) => r.storeId === s && r.date.slice(0, 10) === d);
      if (rs.length) row[s] = Math.min(...rs.map(packagePrice));
    }
    return row;
  });
  const colorOf = (s: ID) => theme.series(stores.get(s)?.color ?? '#2a78d6');

  return (
    <figure>
      <figcaption className="sr-only">Histórico de preços por lugar. Os valores estão na lista de registros abaixo.</figcaption>
      <div className="h-56 w-full">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={theme.grid} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(t) => formatShort(new Date(t).toISOString())}
              tick={{ fill: theme.axis, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              minTickGap={24}
              padding={{ left: 12, right: 12 }}
            />
            <YAxis
              width={58}
              tick={{ fill: theme.axis, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={axisMoney}
              domain={['auto', 'auto']}
            />
            <Tooltip
              cursor={{ stroke: theme.axis, strokeWidth: 1 }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <ChartTooltip
                    title={formatDate(new Date(payload[0].payload.t).toISOString())}
                    rows={payload.map((p) => ({ color: p.color, label: stores.get(String(p.dataKey))?.name ?? '', value: money(Number(p.value)) }))}
                  />
                ) : null
              }
            />
            {storeIds.map((s) => (
              <Line
                key={s}
                type="monotone"
                dataKey={s}
                name={stores.get(s)?.name}
                stroke={colorOf(s)}
                strokeWidth={2}
                connectNulls
                dot={{ r: 4, strokeWidth: 2, stroke: theme.surface, fill: colorOf(s) }}
                activeDot={{ r: 5, strokeWidth: 2, stroke: theme.surface }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {storeIds.length > 1 && (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Legenda">
          {storeIds.map((s) => (
            <li key={s} className="flex items-center gap-1.5">
              <span className="h-2 w-4 rounded-full" style={{ background: colorOf(s) }} aria-hidden />
              {stores.get(s)?.name}
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}
