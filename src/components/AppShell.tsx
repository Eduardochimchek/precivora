import { Link, Outlet, useLocation } from 'react-router-dom';
import { ErrorBoundary, ScreenError } from './ErrorBoundary';
import { Fuel, History, House, LayoutGrid, ListChecks, MapPin, Package, Scale, Settings, Wallet } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Logo, cx } from '@/design-system';

const MAIN = [
  { to: '/', label: 'Início', icon: House, end: true, tour: 'nav-inicio' },
  { to: '/comparar', label: 'Comparar', icon: Scale, tour: 'nav-comparar' },
  { to: '/listas', label: 'Listas', icon: ListChecks, tour: 'nav-listas' },
  { to: '/historico', label: 'Histórico', icon: History, tour: 'nav-historico' },
  { to: '/mais', label: 'Mais', icon: LayoutGrid, tour: 'nav-mais' },
];

const SIDE_EXTRA = [
  { to: '/combustiveis', label: 'Combustíveis', icon: Fuel },
  { to: '/produtos', label: 'Produtos', icon: Package },
  { to: '/lugares', label: 'Lugares', icon: MapPin },
  { to: '/orcamento', label: 'Orçamento', icon: Wallet },
  { to: '/ajustes', label: 'Ajustes', icon: Settings },
];

/** Rotas que pertencem a cada aba (para manter a aba acesa nas telas internas). */
const SECTION: [RegExp, string][] = [
  [/^\/(comparar|combustiveis|produtos\/)/, '/comparar'],
  [/^\/listas/, '/listas'],
  [/^\/(historico|compras)/, '/historico'],
  [/^\/(mais|lugares|tipos|mercados|postos|produtos$|marcas|avaliacoes|orcamento|backup|ajustes)/, '/mais'],
];

/** Telas abertas de vários lugares: mantêm acesa a aba de onde a pessoa veio. */
const SHARED = /^\/(produtos\/|lugares\/|mercados\/|postos\/|mapa|notas\/|compras\/)/;

export function AppShell() {
  const { pathname } = useLocation();
  const lastSection = useRef('');
  const mapped = SECTION.find(([re]) => re.test(pathname))?.[1] ?? (pathname === '/' ? '/' : '');
  const shared = SHARED.test(pathname);
  const section = shared && lastSection.current ? lastSection.current : mapped;
  if (!shared && mapped) lastSection.current = mapped;

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[248px_1fr]">
      <a href="#conteudo" className="sr-only z-50 rounded bg-surface px-3 py-2 focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Pular para o conteúdo
      </a>
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface px-4 pb-6 pt-7 md:flex" aria-label="Navegação principal">
        <Logo className="px-2" />
        <nav className="mt-8 flex flex-col gap-1">
          {MAIN.map((i) => (
            <SideLink key={i.to} {...i} active={section === i.to} />
          ))}
          <div className="my-3 h-px bg-line" />
          {SIDE_EXTRA.map((i) => (
            <SideLink key={i.to} {...i} active={pathname.startsWith(i.to)} />
          ))}
        </nav>
        <p className="mt-auto px-2 text-xs leading-relaxed text-muted">Seus dados ficam neste aparelho. Faça backups com frequência.</p>
      </aside>

      <main id="conteudo" className="pb-nav pt-safe min-w-0 md:pb-12">
        <div className={cx('mx-auto w-full max-w-3xl px-4 md:px-8', pathname === '/' && 'xl:max-w-6xl')}>
          <ErrorBoundary key={pathname} fallback={<ScreenError />}>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>

      <nav
        aria-label="Navegação principal"
        className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-md md:hidden"
      >
        <ul className="mx-auto flex h-[var(--nav-h)] max-w-lg items-stretch">
          {MAIN.map(({ to, label, icon: Icon, tour }) => {
            const active = section === to;
            return (
              <li key={to} className="flex-1" data-tour={tour}>
                <Link
                  to={to}
                  aria-current={active ? 'page' : undefined}
                  className="group flex h-full flex-col items-center justify-center gap-1 text-[11px] font-semibold"
                >
                  <span
                    className={cx(
                      'flex h-8 w-14 items-center justify-center rounded-full transition-colors',
                      active ? 'bg-navy text-lime dark:bg-lime dark:text-navy' : 'text-muted group-hover:text-ink',
                    )}
                  >
                    <Icon className="h-[20px] w-[20px]" strokeWidth={active ? 2.4 : 2} aria-hidden />
                  </span>
                  <span className={active ? 'text-ink' : 'text-muted'}>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function SideLink({ to, label, icon: Icon, active, tour }: { to: string; label: string; icon: typeof House; active: boolean; end?: boolean; tour?: string }) {
  return (
    <Link
      to={to}
      data-tour={tour}
      aria-current={active ? 'page' : undefined}
      className={cx(
        'flex h-11 items-center gap-3 rounded-md px-3 text-[15px] font-semibold transition-colors',
        active ? 'bg-navy text-[#F1F5F9] dark:bg-raised' : 'text-muted hover:bg-sunken hover:text-ink',
      )}
    >
      <Icon className={cx('h-5 w-5', active && 'text-lime')} aria-hidden />
      {label}
    </Link>
  );
}
