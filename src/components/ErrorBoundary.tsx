import { Component, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[Precivora]', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;
    return <FatalScreen title="Algo deu errado nesta tela" detail="Seus dados continuam salvos no aparelho. Recarregue o app para continuar." />;
  }
}

export function FatalScreen({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="max-w-sm text-muted">{detail}</p>
      <button className="h-11 rounded-md bg-primary px-5 font-semibold text-on-primary" onClick={() => window.location.reload()}>
        Recarregar
      </button>
    </div>
  );
}

/** Erro dentro de uma tela: o menu continua funcionando e trocar de tela limpa o erro. */
export function ScreenError() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center" role="alert">
      <h1 className="text-2xl font-bold">Algo deu errado nesta tela</h1>
      <p className="max-w-sm text-muted">Seus dados continuam salvos no aparelho. Volte ao início ou recarregue o app.</p>
      <div className="flex flex-wrap justify-center gap-2">
        <a href="#/" className="inline-flex h-11 items-center rounded-md border border-line px-5 font-semibold hover:bg-sunken">
          Voltar ao início
        </a>
        <button className="h-11 rounded-md bg-primary px-5 font-semibold text-on-primary" onClick={() => window.location.reload()}>
          Recarregar
        </button>
      </div>
    </div>
  );
}
