import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { IconButton } from '@/design-system';
import { useGoBack } from '@/app/useGoBack';

/** `back`: mostra o Voltar, que volta à tela anterior; a string é para onde ir quando não há tela anterior (link direto). */
export function PageHeader({ title, subtitle, back, actions }: { title: string; subtitle?: ReactNode; back?: boolean | string; actions?: ReactNode }) {
  const goBack = useGoBack();
  return (
    <header className="flex flex-wrap items-start gap-x-2 gap-y-3 pb-5 pt-5 md:pt-9">
      {back && (
        <IconButton label="Voltar" className="-ml-3 mt-0.5" onClick={() => goBack(typeof back === 'string' ? back : '/')}>
          <ArrowLeft className="h-5 w-5" />
        </IconButton>
      )}
      <div className="min-w-0 flex-1 basis-48">
        <h1 className="text-balance text-[28px] font-bold leading-[1.1] md:text-[34px]">{title}</h1>
        {subtitle && <div className="mt-1.5 text-sm text-muted">{subtitle}</div>}
      </div>
      {actions && <div className="ml-auto flex shrink-0 items-center gap-1 pt-0.5">{actions}</div>}
    </header>
  );
}
