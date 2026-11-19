import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { useSettings } from '@/app/SettingsContext';
import { appVersion, isNewer } from '@/app/updateCheck';
import { IconButton } from '@/design-system';

const DISMISS_KEY = 'precivora:versao-dispensada';

/** Aviso de versão nova publicada no GitHub (app Android). Some ao dispensar até sair outra versão. */
export function UpdateBanner() {
  const { settings } = useSettings();
  const [current, setCurrent] = useState<string>();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) ?? '';
    } catch {
      return '';
    }
  });
  useEffect(() => {
    void appVersion().then(setCurrent);
  }, []);

  const latest = settings.updateLatest;
  if (!current || !latest || !isNewer(latest.version, current) || dismissed === latest.version) return null;

  return (
    <section aria-label="Versão nova" className="flex items-start gap-3 rounded-xl border border-accent/30 bg-accent/[.07] p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
        <Download className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Versão {latest.version} disponível</p>
        <p className="mt-0.5 text-sm text-muted">Você está na {current}. A atualização instala por cima e mantém seus dados.</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <a href={latest.apk} target="_blank" rel="noreferrer noopener" className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary">
            <Download className="h-4 w-4" aria-hidden />
            Baixar e instalar
          </a>
          <a href={latest.page} target="_blank" rel="noreferrer noopener" className="py-2 text-sm font-semibold text-accent">
            O que mudou
          </a>
        </div>
      </div>
      <IconButton
        label="Dispensar aviso desta versão"
        className="-mr-2 -mt-2"
        onClick={() => {
          try {
            localStorage.setItem(DISMISS_KEY, latest.version);
          } catch {
            /* sem armazenamento: some só nesta abertura */
          }
          setDismissed(latest.version);
        }}
      >
        <X className="h-4 w-4" />
      </IconButton>
    </section>
  );
}
