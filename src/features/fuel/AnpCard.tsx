import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button, Card, Toggle, useFeedback } from '@/design-system';
import { useSettings } from '@/app/SettingsContext';
import { isNative } from '@/app/native';
import { formatDate, relativeDays } from '@/utils/date';

/** Preços do levantamento semanal da ANP: atualizar agora ou sozinho no Wi-Fi. */
export function AnpCard() {
  const { settings, update } = useSettings();
  const { toast } = useFeedback();
  const [busy, setBusy] = useState(false);
  if (!isNative) return null;

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
    </Card>
  );
}
