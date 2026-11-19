import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { exportBackup } from '@/services/backup';
import { getSettings, saveSettings } from '@/repositories/settings';
import { isNative } from './native';

export const AUTO_BACKUP_DIR = 'Precivora/Automatico';
export const AUTO_BACKUP_LABEL = 'Documentos/Precivora/Automatico';
const PREFIX = 'precivora-auto-';

export interface AutoBackupFile {
  name: string;
  size: number;
  mtime: number;
}

const stamp = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
};

/** Cópias automáticas que este app gravou, da mais nova para a mais antiga. */
export async function listAutoBackups(): Promise<AutoBackupFile[]> {
  if (!isNative) return [];
  try {
    const { files } = await Filesystem.readdir({ path: AUTO_BACKUP_DIR, directory: Directory.Documents });
    return files
      .filter((f) => f.type === 'file' && f.name.startsWith(PREFIX) && f.name.endsWith('.json'))
      .map((f) => ({ name: f.name, size: Number(f.size) || 0, mtime: Number(f.mtime) || 0 }))
      .sort((a, b) => b.name.localeCompare(a.name));
  } catch {
    return [];
  }
}

let running: Promise<AutoBackupFile> | null = null;

/** Grava uma cópia agora e apaga as que passam do limite de cópias guardadas. */
export function runAutoBackup(): Promise<AutoBackupFile> {
  if (!isNative) return Promise.reject(new Error('O backup automático funciona no app Android.'));
  running ??= (async () => {
    try {
      const s = await getSettings();
      const now = new Date();
      const content = JSON.stringify(await exportBackup());
      const name = `${PREFIX}${stamp(now)}.json`;
      await Filesystem.writeFile({ path: `${AUTO_BACKUP_DIR}/${name}`, data: content, directory: Directory.Documents, encoding: Encoding.UTF8, recursive: true });
      const size = new Blob([content]).size;
      const files = await listAutoBackups();
      for (const old of files.slice(Math.max(1, s.autoBackupKeep))) {
        await Filesystem.deleteFile({ path: `${AUTO_BACKUP_DIR}/${old.name}`, directory: Directory.Documents }).catch(() => undefined);
      }
      await saveSettings({ lastAutoBackupAt: now.toISOString(), lastAutoBackupBytes: size });
      return { name, size, mtime: now.getTime() };
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Apaga todas as cópias automáticas. Devolve quantas apagou. */
export async function deleteAutoBackups(): Promise<number> {
  let n = 0;
  for (const f of await listAutoBackups()) {
    await Filesystem.deleteFile({ path: `${AUTO_BACKUP_DIR}/${f.name}`, directory: Directory.Documents }).then(() => n++, () => undefined);
  }
  return n;
}

export const nextAutoBackupAt = (last: string | undefined, days: number) => (last ? new Date(Date.parse(last) + days * 86_400_000) : new Date());

/** Ao abrir ou voltar ao app: grava se estiver ligado e o intervalo escolhido já passou. Falhas ficam silenciosas. */
export async function maybeAutoBackup(): Promise<void> {
  if (!isNative) return;
  const s = await getSettings();
  if (!s.autoBackup) return;
  if (s.lastAutoBackupAt && nextAutoBackupAt(s.lastAutoBackupAt, s.autoBackupDays).getTime() > Date.now()) return;
  await runAutoBackup().catch(() => undefined);
}
