import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { IconButton } from '@/design-system';

export function PageHeader({ title, subtitle, back, actions }: { title: string; subtitle?: ReactNode; back?: boolean | string; actions?: ReactNode }) {
  const navigate = useNavigate();
  return (
    <header className="flex items-start gap-2 pb-5 pt-5 md:pt-9">
      {back && (
        <IconButton
          label="Voltar"
          className="-ml-3 mt-0.5"
          onClick={() => (typeof back === 'string' ? navigate(back) : window.history.length > 1 ? navigate(-1) : navigate('/'))}
        >
          <ArrowLeft className="h-5 w-5" />
        </IconButton>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-balance text-[28px] font-bold leading-[1.1] md:text-[34px]">{title}</h1>
        {subtitle && <div className="mt-1.5 text-sm text-muted">{subtitle}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1 pt-0.5">{actions}</div>}
    </header>
  );
}
