import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isNative } from '@/app/native';

export function downloadText(content: string, filename: string, type = 'application/json'): void {
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Salva o arquivo e devolve onde ficou: no app, em Documentos/Precivora; no navegador, nos downloads. */
export async function saveFile(content: string, filename: string, type = 'application/json'): Promise<string> {
  if (isNative) {
    await Filesystem.writeFile({ path: `Precivora/${filename}`, data: content, directory: Directory.Documents, encoding: Encoding.UTF8, recursive: true });
    return 'Documentos/Precivora';
  }
  downloadText(content, filename, type);
  return 'seus downloads';
}

export type ShareOutcome = 'shared' | 'cancelled' | 'unsupported';

/** Se o aparelho consegue compartilhar arquivos (app Android, Chrome do Android, iOS; quase nunca no desktop). */
export function canShareFiles(): boolean {
  if (isNative) return true;
  if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function' || typeof File === 'undefined') return false;
  try {
    return navigator.canShare({ files: [new File(['{}'], 'teste.json', { type: 'application/json' })] });
  } catch {
    return false;
  }
}

async function shareNative(content: string, filename: string, title: string): Promise<ShareOutcome> {
  const { uri } = await Filesystem.writeFile({ path: filename, data: content, directory: Directory.Cache, encoding: Encoding.UTF8 });
  try {
    await Share.share({ title, files: [uri] });
    return 'shared';
  } catch (err) {
    return /cancel/i.test((err as Error)?.message ?? '') ? 'cancelled' : 'unsupported';
  }
}

/** Abre a folha de compartilhamento do sistema (WhatsApp, Drive, e-mail...) com o arquivo. */
export async function shareText(content: string, filename: string, title: string, type = 'application/json'): Promise<ShareOutcome> {
  if (isNative) return shareNative(content, filename, title);
  if (!canShareFiles()) return 'unsupported';
  const file = new File([content], filename, { type });
  if (!navigator.canShare({ files: [file] })) return 'unsupported';
  try {
    await navigator.share({ files: [file], title });
    return 'shared';
  } catch (err) {
    if ((err as DOMException)?.name === 'AbortError') return 'cancelled';
    return 'unsupported';
  }
}
