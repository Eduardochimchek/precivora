import { App } from '@capacitor/app';
import { closeTopSheet } from '@/design-system/Sheet';

/** Botão voltar do Android: fecha o painel aberto, volta uma tela ou sai do app na tela inicial. */
export function setupNativeBridge(): void {
  void App.addListener('backButton', ({ canGoBack }) => {
    if (closeTopSheet()) return;
    const atHome = location.hash === '' || location.hash === '#/' || location.hash === '#';
    if (canGoBack && !atHome) window.history.back();
    else void App.exitApp();
  });
}
