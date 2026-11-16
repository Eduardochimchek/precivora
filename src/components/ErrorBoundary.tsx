import { Component, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[Precivora]', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
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
