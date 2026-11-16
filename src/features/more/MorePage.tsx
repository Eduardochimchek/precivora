import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronRight, Download, Fuel, LayoutList, MapPin, Package, Settings, ShieldCheck, Smartphone, Star, Tags, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button, Card, Logo } from '@/design-system';
import { useSettings } from '@/app/SettingsContext';
import { isIOS, isStandalone, useInstallPrompt } from '@/app/install';
import { daysBetween } from '@/utils/date';

const GROUPS = [
  {
    title: 'Cadastros',
    links: [
      { to: '/lugares', label: 'Lugares', icon: MapPin },
      { to: '/produtos', label: 'Produtos', icon: Package },
      { to: '/tipos', label: 'Tipos de lugar', icon: LayoutList },
      { to: '/marcas', label: 'Marcas e categorias', icon: Tags },
    ],
  },
  {
    title: 'Planejamento',
    links: [
      { to: '/combustiveis', label: 'Comparar combustíveis', icon: Fuel },
      { to: '/avaliacoes', label: 'Avaliações', icon: Star },
      { to: '/orcamento', label: 'Orçamento', icon: Wallet },
    ],
  },
  {
    title: 'App',
    links: [
      { to: '/backup', label: 'Backup e restauração', icon: ShieldCheck },
      { to: '/ajustes', label: 'Ajustes', icon: Settings },
    ],
  },
];

export default function MorePage() {
  const { settings } = useSettings();
  const install = useInstallPrompt();
  const backupOld = !settings.lastBackupAt || daysBetween(settings.lastBackupAt) > 30;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Mais" />
      {backupOld && (
        <Link to="/backup" className="flex items-center gap-3 rounded-lg border border-warn/40 bg-warn/[.08] p-4 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-warn" aria-hidden />
          <span className="flex-1">{settings.lastBackupAt ? 'Seu último backup tem mais de 30 dias.' : 'Você ainda não fez backup. Seus dados só existem neste aparelho.'}</span>
          <ChevronRight className="h-4 w-4 text-muted" aria-hidden />
        </Link>
      )}

      {!isStandalone() && (install.available || isIOS()) && (
        <Card className="flex items-start gap-3 p-4">
          <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
          <div className="flex-1 text-sm">
            <p className="font-semibold">Instale o Precivora</p>
            <p className="mt-0.5 text-muted">
              {install.available
                ? 'Abre como app, funciona sem internet e o navegador tende a preservar melhor seus dados.'
                : 'No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”.'}
            </p>
            {install.available && (
              <Button size="sm" className="mt-3" icon={<Download className="h-4 w-4" />} onClick={() => void install.install()}>
                Instalar
              </Button>
            )}
          </div>
        </Card>
      )}

      {GROUPS.map((g) => (
        <section key={g.title} aria-labelledby={`g-${g.title}`}>
          <h2 id={`g-${g.title}`} className="mb-2 text-sm font-semibold text-muted">
            {g.title}
          </h2>
          <ul className="divide-y divide-line overflow-hidden rounded-lg bg-surface shadow-card">
            {g.links.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <Link to={to} className="flex h-14 items-center gap-3 px-4 hover:bg-sunken">
                  <Icon className="h-5 w-5 text-muted" aria-hidden />
                  <span className="flex-1 font-semibold">{label}</span>
                  <ChevronRight className="h-4 w-4 text-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <footer className="flex flex-col items-center gap-2 py-4 text-center">
        <Logo />
        <p className="text-sm text-muted">Sua economia começa aqui.</p>
        <p className="text-xs text-muted">Versão 1.0.0 · código aberto · sem rastreadores</p>
      </footer>
    </div>
  );
}
