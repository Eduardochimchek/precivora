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

export type ShareOutcome = 'shared' | 'cancelled' | 'unsupported';

/** Se o aparelho consegue compartilhar arquivos (Android, iOS; quase nunca no desktop). */
export function canShareFiles(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function' || typeof File === 'undefined') return false;
  try {
    return navigator.canShare({ files: [new File(['{}'], 'teste.json', { type: 'application/json' })] });
  } catch {
    return false;
  }
}

/** Abre a folha de compartilhamento do sistema (WhatsApp, Drive, e-mail...) com o arquivo. */
export async function shareText(content: string, filename: string, title: string, type = 'application/json'): Promise<ShareOutcome> {
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
