import { App } from '@capacitor/app';
import { closeTopSheet } from '@/design-system/Sheet';

const autoUpdate = () => {
  void import('./autoBackup').then((m) => m.maybeAutoBackup());
  void import('./anpNative').then((m) => m.maybeAutoUpdateAnp());
  void import('./geocodeRunner').then((m) => m.runGeocoding());
};

/** Botão voltar do Android (fecha o painel aberto, volta uma tela ou sai na inicial) e atualizações ao abrir o app. */
export function setupNativeBridge(): void {
  void App.addListener('backButton', ({ canGoBack }) => {
    if (closeTopSheet()) return;
    const atHome = location.hash === '' || location.hash === '#/' || location.hash === '#';
    if (canGoBack && !atHome) window.history.back();
    else void App.exitApp();
  });
  void App.addListener('resume', autoUpdate);
  window.setTimeout(autoUpdate, 4000);
}
