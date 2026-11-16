import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, OctagonAlert } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { PageHeader } from '@/components/PageHeader';
import { Button, Card, ListSkeleton, ProgressBar, Section, TextField, useFeedback } from '@/design-system';
import { useSettings } from '@/app/SettingsContext';
import { useCategories, useMapById, usePrices, useProducts, usePurchaseItems, usePurchases } from '@/hooks/useData';
import { budgetLevel, categoryBudgetStatus, categorySpending, estimatedSavings, type BudgetLevel } from '@/services/analytics';
import { setCategoryLimit } from '@/repositories/budget';
import { formatMonthLong, startOfMonth } from '@/utils/date';
import { money, parseDecimal, percent, toInputDecimal } from '@/utils/format';
import { capitalizeFirst } from '@/utils/text';

const LEVEL: Record<BudgetLevel, { label: string; icon: typeof CheckCircle2; cls: string }> = {
  ok: { label: 'Dentro do limite', icon: CheckCircle2, cls: 'text-success' },
  warn: { label: 'Perto do limite', icon: AlertTriangle, cls: 'text-warn' },
  over: { label: 'Limite ultrapassado', icon: OctagonAlert, cls: 'text-danger' },
  none: { label: 'Sem limite', icon: CheckCircle2, cls: 'text-muted' },
};

export default function BudgetPage() {
  const { settings, update } = useSettings();
  const { toast } = useFeedback();
  const purchases = usePurchases();
  const items = usePurchaseItems();
  const prices = usePrices();
  const productMap = useMapById(useProducts());
  const categoriesList = useCategories();
  const categories = useMapById(categoriesList);
  const budgets = useLiveQuery(() => db.categoryBudgets.toArray(), []);
  const [monthly, setMonthly] = useState(settings.monthlyBudget ? toInputDecimal(settings.monthlyBudget) : '');
  const [goal, setGoal] = useState(settings.savingsGoal ? toInputDecimal(settings.savingsGoal) : '');

  const data = useMemo(() => {
    if (!purchases || !items || !prices || !budgets) return null;
    const from = startOfMonth().toISOString();
    const inMonth = (p: { date: string }) => p.date >= from;
    const spent = purchases.filter(inMonth).reduce((s, p) => s + p.total, 0);
    const spend = categorySpending(items, purchases, productMap, categories, inMonth);
    return {
      spent,
      savings: estimatedSavings(items, purchases, prices, inMonth),
      spend,
      status: categoryBudgetStatus(budgets, spend, categories),
    };
  }, [purchases, items, prices, budgets, productMap, categories]);

  const level = data ? budgetLevel(data.spent, settings.monthlyBudget) : 'none';
  const L = LEVEL[level];
  const daysLeft = (() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() - d.getDate() + 1;
  })();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader back="/mais" title="Orçamento" subtitle={capitalizeFirst(formatMonthLong(new Date()))} />
      {!data ? (
        <ListSkeleton rows={3} />
      ) : (
        <>
          <Card className="p-5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-semibold text-muted">Gasto no mês</span>
              <span className={`flex items-center gap-1.5 text-xs font-semibold ${L.cls}`}>
                <L.icon className="h-4 w-4" aria-hidden />
                {L.label}
              </span>
            </div>
            <p className="price mt-1 text-4xl font-bold">
              {money(data.spent)}
              {settings.monthlyBudget > 0 && <span className="ml-2 font-sans text-base font-normal text-muted">de {money(settings.monthlyBudget)}</span>}
            </p>
            {settings.monthlyBudget > 0 && (
              <>
                <div className="mt-3">
                  <ProgressBar value={data.spent / settings.monthlyBudget} tone={level} label="Orçamento consumido" />
                </div>
                <p className="mt-2 text-sm text-muted">
                  {percent(data.spent / settings.monthlyBudget)} usado ·{' '}
                  {data.spent < settings.monthlyBudget
                    ? `restam ${money(settings.monthlyBudget - data.spent)} para ${daysLeft} dia${daysLeft > 1 ? 's' : ''}`
                    : `${money(data.spent - settings.monthlyBudget)} acima do orçamento`}
                </p>
              </>
            )}
            {settings.savingsGoal > 0 && (
              <div className="mt-4 border-t border-line pt-4">
                <div className="mb-2 flex justify-between text-sm">
                  <span className="text-muted">Meta de economia</span>
                  <span className="price font-bold">
                    <span className="text-lime-ink">{money(data.savings)}</span> de {money(settings.savingsGoal)}
                  </span>
                </div>
                <ProgressBar value={data.savings / settings.savingsGoal} tone="ok" label="Meta de economia alcançada" />
              </div>
            )}
          </Card>

          <Section title="Metas do mês" id="metas">
            <Card className="flex flex-col gap-4 p-4">
              <TextField label="Orçamento mensal" prefix="R$" inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} hint="Deixe em branco para não usar." />
              <TextField
                label="Meta de economia"
                prefix="R$"
                inputMode="decimal"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                hint="Comparada à economia estimada das suas compras."
              />
              <Button
                className="self-start"
                onClick={async () => {
                  const m = parseDecimal(monthly);
                  const g = parseDecimal(goal);
                  await update({ monthlyBudget: m > 0 ? m : 0, savingsGoal: g > 0 ? g : 0 });
                  toast('Metas salvas');
                }}
              >
                Salvar metas
              </Button>
            </Card>
          </Section>

          <Section title="Limite por categoria" id="limites">
            <p className="-mt-1 text-xs text-muted">Alerta em amarelo a partir de 80% e em vermelho ao passar do limite.</p>
            <Card className="divide-y divide-line">
              {categoriesList?.map((c) => {
                const st = data.status.find((s) => s.budget.categoryId === c.id);
                const spent = data.spend.find((s) => s.categoryId === c.id)?.total ?? 0;
                return <CategoryRow key={c.id} name={c.name} color={c.color} spent={spent} limit={st?.budget.limit ?? 0} level={st?.level ?? 'none'} onSave={(v) => setCategoryLimit(c.id, v)} />;
              })}
            </Card>
          </Section>
        </>
      )}
    </div>
  );
}

function CategoryRow({ name, color, spent, limit, level, onSave }: { name: string; color: string; spent: number; limit: number; level: BudgetLevel; onSave: (v: number) => Promise<void> }) {
  const [value, setValue] = useState(limit ? toInputDecimal(limit) : '');
  const L = LEVEL[level];
  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} aria-hidden />
        <span className="min-w-0 flex-1 truncate font-semibold">{name}</span>
        <span className="price text-sm font-bold">{money(spent)}</span>
        <label className="sr-only" htmlFor={`lim-${name}`}>
          Limite de {name}
        </label>
        <input
          id={`lim-${name}`}
          inputMode="decimal"
          placeholder="limite"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => void onSave(parseDecimal(value) || 0)}
          className="h-9 w-24 rounded-md border border-line bg-surface px-2 text-right text-sm focus:border-accent focus:outline-none"
        />
      </div>
      {limit > 0 && (
        <div className="flex items-center gap-2">
          <ProgressBar value={spent / limit} tone={level} label={`Limite de ${name}`} />
          <L.icon className={`h-4 w-4 shrink-0 ${L.cls}`} aria-label={L.label} />
        </div>
      )}
    </div>
  );
}
