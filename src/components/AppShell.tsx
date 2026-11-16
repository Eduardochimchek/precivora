import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Fuel, History, House, LayoutGrid, ListChecks, Package, Scale, Settings, Store, Wallet } from 'lucide-react';
import { useEffect } from 'react';
import { Logo, cx } from '@/design-system';

const MAIN = [
  { to: '/', label: 'Início', icon: House, end: true },
  { to: '/comparar', label: 'Comparar', icon: Scale },
  { to: '/listas', label: 'Listas', icon: ListChecks },
  { to: '/historico', label: 'Histórico', icon: History },
  { to: '/mais', label: 'Mais', icon: LayoutGrid },
];

const SIDE_EXTRA = [
  { to: '/combustiveis', label: 'Combustíveis', icon: Fuel },
  { to: '/produtos', label: 'Produtos', icon: Package },
  { to: '/mercados', label: 'Mercados', icon: Store },
  { to: '/orcamento', label: 'Orçamento', icon: Wallet },
  { to: '/ajustes', label: 'Ajustes', icon: Settings },
];

/** Rotas que pertencem a cada aba (para manter a aba acesa nas telas internas). */
const SECTION: [RegExp, string][] = [
  [/^\/(comparar|combustiveis|produtos\/)/, '/comparar'],
  [/^\/listas/, '/listas'],
  [/^\/(historico|compras)/, '/historico'],
  [/^\/(mais|mercados|postos|produtos$|marcas|avaliacoes|orcamento|backup|ajustes)/, '/mais'],
];

export function AppShell() {
  const { pathname } = useLocation();
  const section = SECTION.find(([re]) => re.test(pathname))?.[1] ?? (pathname === '/' ? '/' : '');

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
          <Outlet />
        </div>
      </main>

      <nav
        aria-label="Navegação principal"
        className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-md md:hidden"
      >
        <ul className="mx-auto flex h-[var(--nav-h)] max-w-lg items-stretch">
          {MAIN.map(({ to, label, icon: Icon, end }) => {
            const active = section === to;
            return (
              <li key={to} className="flex-1">
                <NavLink
                  to={to}
                  end={end}
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
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function SideLink({ to, label, icon: Icon, active, end }: { to: string; label: string; icon: typeof House; active: boolean; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      aria-current={active ? 'page' : undefined}
      className={cx(
        'flex h-11 items-center gap-3 rounded-md px-3 text-[15px] font-semibold transition-colors',
        active ? 'bg-navy text-[#F1F5F9] dark:bg-raised' : 'text-muted hover:bg-sunken hover:text-ink',
      )}
    >
      <Icon className={cx('h-5 w-5', active && 'text-lime')} aria-hidden />
      {label}
    </NavLink>
  );
}
