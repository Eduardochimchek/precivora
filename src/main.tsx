import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { boot, hideSplash } from './app/boot';
import { FatalScreen } from './components/ErrorBoundary';
import './styles/index.css';
import { isNative } from './app/native';
import { setupNativeBridge } from './app/nativeBridge';

if (isNative) setupNativeBridge();

const root = createRoot(document.getElementById('root')!);

boot()
  .then(({ settings }) => {
    root.render(
      <StrictMode>
        <App settings={settings} />
      </StrictMode>,
    );
    requestAnimationFrame(() => hideSplash());
  })
  .catch((err: Error) => {
    console.error('[Precivora] falha ao iniciar', err);
    const blocked = err?.message === 'indexeddb-unavailable' || err?.name === 'InvalidStateError' || err?.name === 'OpenFailedError';
    root.render(
      <FatalScreen
        title="Não foi possível abrir seus dados"
        detail={
          blocked
            ? 'O navegador bloqueou o armazenamento local (comum em janelas anônimas). Abra o Precivora em uma janela normal.'
            : 'Feche outras abas do Precivora e tente de novo. Se continuar, restaure um backup em Ajustes.'
        }
      />,
    );
    hideSplash();
  });
