import { useRegisterSW } from 'virtual:pwa-register/react';
import { useEffect } from 'react';
import { RefreshCw, WifiOff, X } from 'lucide-react';
import { Button, IconButton } from '@/design-system';

/** Avisa quando há versão nova do app. Atualizar troca só os arquivos do app; os dados (IndexedDB) ficam intactos. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (reg) window.setInterval(() => void reg.update(), 60 * 60 * 1000);
    },
  });

  useEffect(() => {
    if (!offlineReady || needRefresh) return;
    const t = window.setTimeout(() => setOfflineReady(false), 4000);
    return () => window.clearTimeout(t);
  }, [offlineReady, needRefresh, setOfflineReady]);

  if (!needRefresh && !offlineReady) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-4 top-[calc(env(safe-area-inset-top)+12px)] z-[70] mx-auto flex max-w-md animate-toast-in items-center gap-3 rounded-lg bg-navy p-3 pl-4 text-sm text-[#F1F5F9] shadow-float dark:bg-raised"
    >
      {needRefresh ? <RefreshCw className="h-5 w-5 shrink-0 text-lime" aria-hidden /> : <WifiOff className="h-5 w-5 shrink-0 text-lime" aria-hidden />}
      <span className="flex-1">{needRefresh ? 'Nova versão disponível. Seus dados continuam salvos.' : 'Pronto para usar sem internet.'}</span>
      {needRefresh && (
        <Button size="sm" variant="save" onClick={() => void updateServiceWorker(true)}>
          Atualizar
        </Button>
      )}
      <IconButton
        label="Fechar"
        className="h-9 w-9 text-[#F1F5F9] hover:bg-white/10"
        onClick={() => {
          setNeedRefresh(false);
          setOfflineReady(false);
        }}
      >
        <X className="h-4 w-4" />
      </IconButton>
    </div>
  );
}
