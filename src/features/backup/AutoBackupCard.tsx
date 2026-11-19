import { useEffect, useState } from 'react';
import { FolderOpen, Save, Trash2 } from 'lucide-react';
import { Button, Card, Section, SelectField, Toggle, useFeedback } from '@/design-system';
import { useSettings } from '@/app/SettingsContext';
import { isNative } from '@/app/native';
import { AUTO_BACKUP_LABEL, deleteAutoBackups, listAutoBackups, nextAutoBackupAt, runAutoBackup, type AutoBackupFile } from '@/app/autoBackup';
import { formatDateTime, relativeDays } from '@/utils/date';

const DAYS = [1, 3, 7, 15, 30];
const KEEP = [2, 4, 8, 12];

export const fileSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** Controle do backup automático: ligar/parar, intervalo, cópias guardadas, onde ficam e quanto ocupam. */
export function AutoBackupCard() {
  const { settings, update } = useSettings();
  const { toast, confirm } = useFeedback();
  const [files, setFiles] = useState<AutoBackupFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [showFiles, setShowFiles] = useState(false);

  useEffect(() => {
    void listAutoBackups().then(setFiles);
  }, [settings.lastAutoBackupAt, settings.autoBackupKeep]);

  if (!isNative) return null;

  const total = files.reduce((s, f) => s + f.size, 0);
  const next = nextAutoBackupAt(settings.lastAutoBackupAt, settings.autoBackupDays);

  async function now() {
    setBusy(true);
    try {
      const f = await runAutoBackup();
      toast(`Backup salvo (${fileSize(f.size)}) em ${AUTO_BACKUP_LABEL}`);
    } catch (err) {
      toast((err as Error).message || 'Não foi possível salvar o backup.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Backup automático" id="automatico">
      <Card className="flex flex-col gap-4 p-4">
        <Toggle
          label="Fazer backup sozinho"
          description="Ao abrir o app, quando passar o intervalo escolhido. Fica só neste celular, sem internet."
          checked={settings.autoBackup}
          onChange={(v) => void update({ autoBackup: v })}
        />
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="A cada" value={settings.autoBackupDays} onChange={(e) => void update({ autoBackupDays: Number(e.target.value) })} disabled={!settings.autoBackup}>
            {DAYS.map((d) => (
              <option key={d} value={d}>
                {d === 1 ? '1 dia' : `${d} dias`}
              </option>
            ))}
          </SelectField>
          <SelectField label="Guardar" value={settings.autoBackupKeep} onChange={(e) => void update({ autoBackupKeep: Number(e.target.value) })}>
            {KEEP.map((k) => (
              <option key={k} value={k}>
                {k} cópias
              </option>
            ))}
          </SelectField>
        </div>

        <dl className="grid grid-cols-[auto,minmax(0,1fr)] gap-x-4 gap-y-1.5 rounded-lg bg-sunken p-3 text-sm">
          <dt className="text-muted">Onde</dt>
          <dd className="font-semibold [overflow-wrap:anywhere]">{AUTO_BACKUP_LABEL}</dd>
          <dt className="text-muted">Último</dt>
          <dd>
            {settings.lastAutoBackupAt ? (
              <time dateTime={settings.lastAutoBackupAt} title={formatDateTime(settings.lastAutoBackupAt)}>
                {relativeDays(settings.lastAutoBackupAt)}
                {settings.lastAutoBackupBytes ? ` · ${fileSize(settings.lastAutoBackupBytes)}` : ''}
              </time>
            ) : (
              'nenhum ainda'
            )}
          </dd>
          <dt className="text-muted">Próximo</dt>
          <dd>{settings.autoBackup ? (next.getTime() <= Date.now() ? 'na próxima vez que abrir o app' : formatDateTime(next.toISOString())) : 'parado'}</dd>
          <dt className="text-muted">Guardados</dt>
          <dd>{files.length ? `${files.length} ${files.length === 1 ? 'cópia' : 'cópias'} · ${fileSize(total)}` : 'nenhuma cópia'}</dd>
        </dl>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={<Save className="h-4 w-4" />} loading={busy} onClick={now}>
            Fazer agora
          </Button>
          {files.length > 0 && (
            <Button variant="ghost" icon={<FolderOpen className="h-4 w-4" />} onClick={() => setShowFiles((v) => !v)} aria-expanded={showFiles}>
              {showFiles ? 'Esconder cópias' : 'Ver cópias'}
            </Button>
          )}
          {files.length > 0 && (
            <Button
              variant="ghost"
              className="text-danger"
              icon={<Trash2 className="h-4 w-4" />}
              onClick={async () => {
                const ok = await confirm({
                  title: 'Apagar as cópias automáticas?',
                  message: `As ${files.length} cópias em ${AUTO_BACKUP_LABEL} serão apagadas. Os dados do app continuam.`,
                  confirmLabel: 'Apagar cópias',
                  danger: true,
                });
                if (!ok) return;
                const n = await deleteAutoBackups();
                setFiles(await listAutoBackups());
                setShowFiles(false);
                toast(`${n} ${n === 1 ? 'cópia apagada' : 'cópias apagadas'}`);
              }}
            >
              Apagar cópias
            </Button>
          )}
        </div>
        {showFiles && (
          <ul className="divide-y divide-line rounded-lg border border-line text-sm">
            {files.map((f) => (
              <li key={f.name} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="min-w-0 truncate">{f.name}</span>
                <span className="shrink-0 text-muted">{fileSize(f.size)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted">
          Para restaurar, use “Restaurar” abaixo e escolha uma cópia nessa pasta. Se o celular for perdido ou formatado, as cópias vão junto: de vez em quando, copie uma para o Drive ou para o computador.
        </p>
      </Card>
    </Section>
  );
}
