import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Download, Trash2 } from 'lucide-react';
import policy from '../../../PRIVACIDADE.md?raw';
import { PageHeader } from '@/components/PageHeader';
import { Card, Section, Toggle } from '@/design-system';
import { useSettings } from '@/app/SettingsContext';
import { isNative } from '@/app/native';

const INLINE = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|`[^`]+`|\*[^*]+\*)/g;

function inline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (part.startsWith('**')) return <strong key={i} className="font-semibold text-ink">{part.slice(2, -2)}</strong>;
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link)
      return (
        <a key={i} href={link[2]} target="_blank" rel="noreferrer noopener" className="font-semibold text-accent underline-offset-2 hover:underline">
          {link[1]}
        </a>
      );
    if (part.startsWith('`')) return <code key={i} className="rounded bg-sunken px-1 text-[13px]">{part.slice(1, -1)}</code>;
    if (part.startsWith('*') && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function Policy({ source }: { source: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push(<p key={blocks.length}>{inline(para.join(' '))}</p>);
    if (list.length)
      blocks.push(
        <ul key={blocks.length} className="flex list-disc flex-col gap-1.5 pl-5">
          {list.map((t, i) => (
            <li key={i}>{inline(t)}</li>
          ))}
        </ul>,
      );
    para = [];
    list = [];
  };
  for (const line of source.split('\n').slice(1)) {
    if (line.startsWith('## ')) {
      flush();
      blocks.push(
        <h2 key={blocks.length} className="pt-3 text-lg font-bold text-ink">
          {line.slice(3)}
        </h2>,
      );
    } else if (line.startsWith('- ')) {
      if (para.length) flush();
      list.push(line.slice(2));
    } else if (!line.trim()) flush();
    else {
      if (list.length) flush();
      para.push(line.trim());
    }
  }
  flush();
  return <div className="flex flex-col gap-3 text-[15px] leading-relaxed text-muted [overflow-wrap:anywhere]">{blocks}</div>;
}

export default function PrivacyPage() {
  const { settings, update } = useSettings();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader back="/mais" title="Privacidade" subtitle="O que fica no aparelho, o que sai e como controlar." />

      <Section title="Envios automáticos" id="envios">
        <Card className="flex flex-col gap-4 p-4">
          <Toggle
            label="Localizar endereços no mapa"
            description="Envia só o endereço dos lugares ao OpenStreetMap, um por segundo, para mostrar no mapa e calcular distâncias."
            checked={settings.geoAuto}
            onChange={(v) => {
              void update({ geoAuto: v });
              void import('@/app/geocodeRunner').then((m) => (v ? window.setTimeout(() => void m.runGeocoding(), 300) : m.stopGeocoding()));
            }}
          />
          {isNative && (
            <Toggle
              label="Atualizar preços da ANP sozinho"
              description="Baixa o arquivo público de preços dos combustíveis no Wi-Fi, no máximo a cada 2 dias. Nada sobre você é enviado."
              checked={settings.anpAuto}
              onChange={(v) => void update({ anpAuto: v })}
            />
          )}
          {isNative && (
            <Toggle
              label="Procurar versão nova"
              description="Ao abrir o app, no máximo uma vez por dia, consulta no GitHub se saiu uma versão nova. Nada sobre você é enviado."
              checked={settings.updateCheck}
              onChange={(v) => void update({ updateCheck: v })}
            />
          )}
          <p className="text-xs text-muted">As outras consultas (nota fiscal, código de barras, mapa, rotas) só acontecem quando você toca nelas.</p>
        </Card>
      </Section>

      <Section title="Seus dados" id="seus-dados">
        <Card className="divide-y divide-line">
          <Link to="/backup" className="flex items-center gap-3 px-4 py-3.5 hover:bg-sunken">
            <Download className="h-5 w-5 text-accent" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Ver e levar seus dados</span>
              <span className="block text-xs text-muted">Exporte um backup com tudo, em arquivo aberto (JSON)</span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted" aria-hidden />
          </Link>
          <Link to="/ajustes#perigo" className="flex items-center gap-3 px-4 py-3.5 hover:bg-sunken">
            <Trash2 className="h-5 w-5 text-danger" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Apagar seus dados</span>
              <span className="block text-xs text-muted">Apaga tudo o que o Precivora guardou neste aparelho</span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted" aria-hidden />
          </Link>
        </Card>
      </Section>

      <Section title="Política de privacidade" id="politica">
        <Card className="p-4">
          <Policy source={policy} />
        </Card>
      </Section>
    </div>
  );
}
