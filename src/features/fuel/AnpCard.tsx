import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button, Card, SelectField, Toggle, cx, useFeedback } from '@/design-system';
import { FUEL_SHORT } from '@/services/fuel';
import { FUEL_TYPES, type Settings } from '@/types';
import { useSettings } from '@/app/SettingsContext';
import { isNative } from '@/app/native';
import { formatDate, relativeDays } from '@/utils/date';

/** Preços do levantamento semanal da ANP: atualizar agora ou sozinho no Wi-Fi. */
export function AnpCard() {
  const { settings, update } = useSettings();
  const { toast } = useFeedback();
  const [busy, setBusy] = useState(false);
  if (!isNative) return null;

  async function setAlert(patch: Partial<Settings>) {
    await update(patch);
    const { syncAnpAlert } = await import('@/app/anpAlert');
    await syncAnpAlert();
  }

  async function toggleAlert(on: boolean) {
    if (on) {
      const { notificationsAllowed } = await import('@/app/anpAlert');
      if (!(await notificationsAllowed(true))) {
        toast('Sem permissão de notificação. Libere nas configurações do Android para receber o aviso.', 'error');
        return;
      }
    }
    await setAlert({ anpAlert: on });
    if (on) toast(`Combinado: todo dia às ${settings.anpAlertHour}h o app confere a ANP e avisa se aparecer preço menor.`);
  }

  async function run() {
    setBusy(true);
    try {
      const { updateAnpPrices } = await import('@/app/anpNative');
      const r = await updateAnpPrices();
      if (!r.stationsMatched) toast('Nenhum posto das suas cidades está na pesquisa da ANP. Ela cobre só alguns municípios.', 'info');
      else if (!r.added && !r.stationsCreated) toast('Os preços da ANP já estavam em dia.');
      else toast([`${r.added} preço${r.added === 1 ? '' : 's'} da ANP`, r.stationsCreated ? `${r.stationsCreated} posto${r.stationsCreated === 1 ? '' : 's'} novo${r.stationsCreated === 1 ? '' : 's'}` : ''].filter(Boolean).join(' e '));
    } catch (err) {
      toast((err as Error).message || 'Não foi possível baixar os preços da ANP.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Preços oficiais da ANP</h2>
          <p className="mt-0.5 text-xs text-muted">
            {settings.anpCheckedAt
              ? `Coleta mais recente: ${settings.anpLatest ? formatDate(settings.anpLatest) : '—'} · verificado ${relativeDays(settings.anpCheckedAt).toLowerCase()}`
              : 'A ANP anota toda semana o preço da bomba em parte dos postos. O app traz esses preços para os seus postos e cadastra os pesquisados nas suas cidades.'}
          </p>
        </div>
        <Button variant="secondary" size="sm" icon={<RefreshCw className="h-4 w-4" />} loading={busy} onClick={run}>
          {busy ? 'Baixando' : 'Atualizar'}
        </Button>
      </div>
      <Toggle
        label="Atualizar sozinho"
        description="Ao abrir o app, no Wi-Fi, no máximo a cada 2 dias (cerca de 12 MB)."
        checked={settings.anpAuto}
        onChange={(v) => void update({ anpAuto: v })}
      />
      <Toggle
        label="Avisar preço baixo"
        description="Todo dia, com o app fechado, confere a coleta da ANP nas suas cidades e manda uma notificação se aparecer preço menor que o menor que você tem. A ANP publica uma coleta por semana."
        checked={settings.anpAlert}
        onChange={(v) => void toggleAlert(v)}
      />
      {settings.anpAlert && (
        <div className="flex flex-col gap-3 rounded-lg bg-sunken p-3">
          <SelectField label="Conferir às" value={settings.anpAlertHour} onChange={(e) => void setAlert({ anpAlertHour: Number(e.target.value) })}>
            {Array.from({ length: 18 }, (_, i) => i + 5).map((h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, '0')}:00
              </option>
            ))}
          </SelectField>
          <Toggle label="Só baixar no Wi-Fi" description="Desligado, usa também os dados móveis." checked={settings.anpAlertWifi} onChange={(v) => void setAlert({ anpAlertWifi: v })} />
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Combustíveis</legend>
            <div className="flex flex-wrap gap-2">
              {FUEL_TYPES.map((f) => {
                const on = settings.anpAlertFuels.includes(f);
                return (
                  <button
                    key={f}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => {
                      const next = on ? settings.anpAlertFuels.filter((x) => x !== f) : [...settings.anpAlertFuels, f];
                      if (next.length) void setAlert({ anpAlertFuels: next });
                    }}
                    className={cx(
                      'h-9 rounded-full border px-3.5 text-sm font-semibold transition-colors',
                      on ? 'border-transparent bg-primary text-on-primary' : 'border-line bg-surface text-muted hover:text-ink',
                    )}
                  >
                    {FUEL_SHORT[f]}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <p className="text-xs text-muted">O arquivo da ANP tem cerca de 12 MB. Ao tocar no aviso, o app abre em Combustíveis e já traz a coleta nova.</p>
        </div>
      )}
    </Card>
  );
}
