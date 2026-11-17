import { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileUp, Share2, ShieldCheck, Smartphone } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button, Card, Section, Segmented, useFeedback } from '@/design-system';
import { useSettings } from '@/app/SettingsContext';
import { analyzeBackup, applyBackup, backupFileName, exportBackup, MAX_BACKUP_BYTES, TABLE_LABEL, type BackupAnalysis, type ImportMode } from '@/services/backup';
import { logActivity } from '@/repositories/activity';
import { canShareFiles, saveFile, shareText } from '@/utils/download';
import { formatDateTime, relativeDays } from '@/utils/date';

export default function BackupPage() {
  const { settings, update } = useSettings();
  const { toast, confirm } = useFeedback();
  const fileRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState<'share' | 'save' | null>(null);
  const [canShare] = useState(canShareFiles);
  const [analysis, setAnalysis] = useState<BackupAnalysis | null>(null);
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [mode, setMode] = useState<ImportMode>('merge');
  const [busy, setBusy] = useState(false);

  async function doExport(how: 'share' | 'save') {
    setExporting(how);
    try {
      const b = await exportBackup();
      const json = JSON.stringify(b);
      const name = backupFileName();
      if (how === 'share') {
        const result = await shareText(json, name, 'Backup do Precivora');
        if (result === 'cancelled') return;
        if (result === 'shared') {
          await update({ lastBackupAt: b.exportedAt });
          await logActivity('backup', 'Backup enviado');
          toast('Backup enviado');
          return;
        }
      }
      const where = await saveFile(json, name);
      await update({ lastBackupAt: b.exportedAt });
      await logActivity('backup', 'Backup exportado');
      toast(`Backup salvo em ${where}`);
    } catch {
      toast('Não foi possível gerar o backup', 'error');
    } finally {
      setExporting(null);
    }
  }

  async function onFile(file?: File) {
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) {
      setAnalysis({ ok: false, errors: ['Arquivo grande demais (limite de 50 MB).'], tables: [] });
      return;
    }
    setBusy(true);
    try {
      const t = await file.text();
      setText(t);
      setFileName(file.name);
      setAnalysis(await analyzeBackup(t, mode));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function changeMode(m: ImportMode) {
    setMode(m);
    if (text) setAnalysis(await analyzeBackup(text, m));
  }

  async function doImport() {
    if (!analysis?.ok) return;
    const ok = await confirm(
      mode === 'replace'
        ? {
            title: 'Substituir todos os dados?',
            message: 'Tudo o que está neste aparelho será apagado e trocado pelo conteúdo do backup. Faça um backup dos dados atuais antes, se precisar deles.',
            confirmLabel: 'Substituir tudo',
            danger: true,
          }
        : { title: 'Mesclar backup?', message: 'Só registros novos serão adicionados. Nada do que já existe será alterado.', confirmLabel: 'Mesclar' },
    );
    if (!ok) return;
    setBusy(true);
    try {
      const n = await applyBackup(analysis, mode);
      await update({ onboardingDone: true });
      toast(mode === 'replace' ? 'Backup restaurado' : `${n} registros adicionados`);
      setAnalysis(null);
      setText('');
    } catch (err) {
      toast(`Falha ao importar: ${(err as Error).message}. Nenhum dado foi alterado.`, 'error');
    } finally {
      setBusy(false);
    }
  }

  const last = settings.lastBackupAt;
  const total = analysis?.tables.reduce((s, t) => s + (mode === 'merge' ? t.added : t.incoming), 0) ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader back="/mais" title="Backup" />
      <Card className="flex items-start gap-3 p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden />
        <div className="text-sm">
          <p className="font-semibold">Seus dados ficam só neste aparelho.</p>
          <p className="mt-1 text-muted">
            O Precivora não tem servidor nem conta. Se você limpar os dados do navegador, desinstalar o app ou trocar de celular sem backup, os registros se perdem.
          </p>
        </div>
      </Card>

      <Section title="Exportar" id="exportar">
        <Card className="flex flex-col gap-3 p-4">
          <p className="text-sm text-muted">
            Gera um arquivo .json com produtos, lugares, preços, avaliações, listas, compras e configurações.{' '}
            {canShare
              ? 'Em “Enviar backup”, escolha onde guardar: Google Drive, WhatsApp para você mesmo, e-mail…'
              : 'Guarde em um lugar seguro (nuvem, e-mail para você mesmo).'}
          </p>
          <p className="text-sm">
            {last ? (
              <>
                Último backup: <strong>{formatDateTime(last)}</strong> ({relativeDays(last)})
              </>
            ) : (
              <span className="flex items-center gap-1.5 text-warn">
                <AlertTriangle className="h-4 w-4" aria-hidden /> Você ainda não fez nenhum backup.
              </span>
            )}
          </p>
          {canShare ? (
            <div className="flex flex-wrap gap-3">
              <Button icon={<Share2 className="h-4 w-4" />} loading={exporting === 'share'} disabled={exporting !== null} onClick={() => doExport('share')}>
                Enviar backup
              </Button>
              <Button variant="secondary" icon={<Download className="h-4 w-4" />} loading={exporting === 'save'} disabled={exporting !== null} onClick={() => doExport('save')}>
                Salvar arquivo
              </Button>
            </div>
          ) : (
            <Button className="self-start" icon={<Download className="h-4 w-4" />} loading={exporting === 'save'} onClick={() => doExport('save')}>
              Exportar backup
            </Button>
          )}
        </Card>
      </Section>

      <Section title="Trocar de celular" id="trocar">
        <Card className="flex items-start gap-3 p-4">
          <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
          <ol className="list-decimal space-y-1.5 pl-4 text-sm">
            <li>
              No celular antigo, toque em <strong>{canShare ? 'Enviar backup' : 'Exportar backup'}</strong> e guarde o arquivo onde o celular novo consiga abrir (Google Drive, WhatsApp, e-mail).
            </li>
            <li>No celular novo, abra o Precivora e baixe o arquivo.</li>
            <li>
              Em <strong>Restaurar</strong>, escolha <strong>Substituir tudo</strong>, toque em <strong>Escolher arquivo</strong> e confirme.
            </li>
          </ol>
        </Card>
      </Section>

      <Section title="Restaurar" id="restaurar">
        <Card className="flex flex-col gap-4 p-4">
          <Segmented
            label="Como importar"
            value={mode}
            onChange={changeMode}
            options={[
              { value: 'merge', label: 'Mesclar' },
              { value: 'replace', label: 'Substituir tudo' },
            ]}
          />
          <p className="text-xs text-muted">
            {mode === 'merge'
              ? 'Adiciona só o que ainda não existe. Marcas e categorias com o mesmo nome são reaproveitadas; nada é duplicado.'
              : 'Apaga os dados atuais e restaura exatamente o conteúdo do backup.'}
          </p>
          <input ref={fileRef} type="file" accept=".json,application/json,text/plain" className="sr-only" id="backup-file" onChange={(e) => onFile(e.target.files?.[0])} />
          <Button variant="secondary" className="self-start" icon={<FileUp className="h-4 w-4" />} loading={busy && !analysis} onClick={() => fileRef.current?.click()}>
            Escolher arquivo
          </Button>

          {analysis && (
            <div className="rounded-lg border border-line p-4" aria-live="polite">
              <p className="mb-2 truncate text-sm font-semibold">{fileName}</p>
              {analysis.ok ? (
                <>
                  <p className="flex items-center gap-1.5 text-sm text-success">
                    <CheckCircle2 className="h-4 w-4" aria-hidden /> Arquivo válido
                    {analysis.exportedAt ? ` · criado em ${formatDateTime(analysis.exportedAt)}` : ''}
                  </p>
                  <table className="mt-3 w-full text-sm">
                    <caption className="sr-only">Resumo do que será importado</caption>
                    <thead>
                      <tr className="text-left text-xs text-muted">
                        <th className="pb-1 font-semibold">Tipo</th>
                        <th className="pb-1 text-right font-semibold">No arquivo</th>
                        {mode === 'merge' && <th className="pb-1 text-right font-semibold">Novos</th>}
                      </tr>
                    </thead>
                    <tbody className="tnum">
                      {analysis.tables.map((t) => (
                        <tr key={t.table} className="border-t border-line">
                          <td className="py-1.5">{TABLE_LABEL[t.table]}</td>
                          <td className="py-1.5 text-right">{t.incoming}</td>
                          {mode === 'merge' && <td className="py-1.5 text-right font-semibold">{t.added}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <Button className="mt-4" variant={mode === 'replace' ? 'danger' : 'primary'} loading={busy} onClick={doImport} disabled={mode === 'merge' && total === 0}>
                    {mode === 'replace' ? 'Substituir pelos dados do backup' : total ? `Importar ${total} registros` : 'Nada novo para importar'}
                  </Button>
                </>
              ) : (
                <div className="text-sm text-danger" role="alert">
                  <p className="flex items-center gap-1.5 font-semibold">
                    <AlertTriangle className="h-4 w-4" aria-hidden /> Não dá para importar este arquivo
                  </p>
                  <ul className="mt-2 list-disc pl-5 text-xs">
                    {analysis.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-muted">Nada foi alterado nos seus dados.</p>
                </div>
              )}
            </div>
          )}
        </Card>
      </Section>
    </div>
  );
}
