import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Monitor, Moon, Sun, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button, Card, Section, Segmented, TextField, useFeedback } from '@/design-system';
import { useSettings } from '@/app/SettingsContext';
import { wipeAllData } from '@/services/backup';
import { db, SCHEMA_VERSION } from '@/db/database';
import { parseDecimal, toInputDecimal } from '@/utils/format';
import type { ThemePreference } from '@/types';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { settings, update } = useSettings();
  const { toast, confirm } = useFeedback();
  const [name, setName] = useState(settings.userName);
  const [stale, setStale] = useState(String(settings.staleDays));
  const [ratio, setRatio] = useState(String(Math.round(settings.flexRatio * 100)));
  const [tanks, setTanks] = useState(settings.tankSizes.join(', '));
  const [trip, setTrip] = useState(toInputDecimal(settings.tripCost));
  const [storage, setStorage] = useState<{ persisted: boolean | null; usage?: number }>({ persisted: null });

  useEffect(() => {
    void (async () => {
      try {
        const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : null;
        const est = navigator.storage?.estimate ? await navigator.storage.estimate() : undefined;
        setStorage({ persisted, usage: est?.usage });
      } catch {
        /* não suportado */
      }
    })();
  }, []);

  async function save() {
    const staleDays = Math.round(parseDecimal(stale));
    const flex = parseDecimal(ratio) / 100;
    const tankSizes = tanks
      .split(/[;,\s]+/)
      .map((t) => Math.round(parseDecimal(t)))
      .filter((t) => t > 0 && t <= 300)
      .slice(0, 3);
    const tripCost = parseDecimal(trip);
    if (!(staleDays >= 1 && staleDays <= 365)) return toast('Dias para desatualizar: use de 1 a 365', 'error');
    if (!(flex > 0.4 && flex < 1)) return toast('Rendimento do etanol: use entre 41% e 99%', 'error');
    if (tankSizes.length === 0) return toast('Informe ao menos um volume de tanque', 'error');
    await update({ userName: name.trim().slice(0, 40), staleDays, flexRatio: flex, tankSizes, tripCost: tripCost >= 0 ? tripCost : 0 });
    toast('Ajustes salvos');
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader back="/mais" title="Ajustes" />

      <Section title="Aparência" id="aparencia">
        <Segmented<ThemePreference>
          label="Tema"
          value={settings.theme}
          onChange={(theme) => update({ theme })}
          options={[
            { value: 'system', label: <><Monitor className="h-4 w-4" aria-hidden /> Automático</> },
            { value: 'light', label: <><Sun className="h-4 w-4" aria-hidden /> Claro</> },
            { value: 'dark', label: <><Moon className="h-4 w-4" aria-hidden /> Escuro</> },
          ]}
        />
        <p className="text-xs text-muted">Automático segue o tema do seu sistema.</p>
      </Section>

      <Section title="Preferências" id="preferencias">
        <Card className="flex flex-col gap-4 p-4">
          <TextField label="Seu nome" optional value={name} onChange={(e) => setName(e.target.value)} maxLength={40} hint="Usado só na saudação do Início." />
          <TextField
            label="Preço fica desatualizado após"
            suffix="dias"
            inputMode="numeric"
            value={stale}
            onChange={(e) => setStale(e.target.value)}
            hint="Preços de produtos mais antigos que isso não contam como “menor preço recente”. Combustível usa 7 dias."
          />
          <TextField
            label="Rendimento do etanol no seu carro"
            suffix="%"
            inputMode="numeric"
            value={ratio}
            onChange={(e) => setRatio(e.target.value)}
            hint="Referência comum: 70%. Para saber o seu: km/L com etanol ÷ km/L com gasolina."
          />
          <TextField label="Volumes para simular abastecimento" suffix="L" value={tanks} onChange={(e) => setTanks(e.target.value)} hint="Até três valores separados por vírgula." />
          <TextField label="Custo de ir a um lugar a mais" prefix="R$" inputMode="decimal" value={trip} onChange={(e) => setTrip(e.target.value)} />
          <Button className="self-start" onClick={save}>
            Salvar ajustes
          </Button>
        </Card>
      </Section>

      <Section title="Privacidade e armazenamento" id="privacidade">
        <Card className="flex flex-col gap-2 p-4 text-sm">
          <p>
            Tudo fica no banco local do navegador (IndexedDB) deste aparelho. O Precivora não tem login, servidor, anúncios nem rastreadores, e não envia seus dados para ninguém.
          </p>
          <p className="text-muted">
            Armazenamento persistente:{' '}
            {storage.persisted == null ? 'não informado pelo navegador' : storage.persisted ? 'ativo (o navegador não apaga sozinho)' : 'não concedido — instale o app e faça backups'}
            {storage.usage != null && ` · uso aproximado: ${(storage.usage / 1024 / 1024).toFixed(1).replace('.', ',')} MB`}
          </p>
          <p className="text-muted">Versão do app 1.0.0 · esquema de dados v{SCHEMA_VERSION}</p>
        </Card>
      </Section>

      <Section title="Zona de perigo" id="perigo">
        <Card className="flex flex-col gap-3 p-4">
          <p className="text-sm text-muted">Apaga todos os produtos, preços, compras, listas, avaliações e ajustes deste aparelho.</p>
          <Button
            variant="danger"
            className="self-start"
            icon={<Trash2 className="h-4 w-4" />}
            onClick={async () => {
              const ok = await confirm({
                title: 'Apagar todos os dados?',
                message: 'Isso não pode ser desfeito. Exporte um backup antes se quiser guardar alguma coisa.',
                confirmLabel: 'Apagar tudo',
                danger: true,
              });
              if (!ok) return;
              await wipeAllData();
              await db.close();
              await db.delete();
              try {
                localStorage.removeItem('precivora:theme');
              } catch {
                /* ignore */
              }
              toast('Dados apagados');
              navigate('/');
              window.location.reload();
            }}
          >
            Apagar todos os dados
          </Button>
        </Card>
      </Section>
    </div>
  );
}
