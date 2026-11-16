import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button, Card, IconButton, ListSkeleton, SEGMENT_ICONS, SegmentIcon, Sheet, TextField, cx, useFeedback } from '@/design-system';
import { usePlaces, useSegments } from '@/hooks/useData';
import { deleteSegment, saveSegment } from '@/repositories/places';
import { PLACE_COLORS } from '@/features/forms/ColorSwatches';
import type { ID } from '@/types';

interface Draft {
  id?: ID;
  name: string;
  icon: string;
  color: string;
  builtin?: boolean;
  fuel?: boolean;
}

export default function SegmentsPage() {
  const { toast, confirm } = useFeedback();
  const segments = useSegments();
  const places = usePlaces();
  const [draft, setDraft] = useState<Draft | null>(null);

  async function save() {
    if (!draft) return;
    try {
      await saveSegment(draft, draft.id);
      toast(draft.id ? 'Tipo atualizado' : 'Tipo criado');
      setDraft(null);
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  return (
    <div>
      <PageHeader
        back="/lugares"
        title="Tipos de lugar"
        subtitle="Mercado, Farmácia e Combustível já vêm prontos. Crie outros para o que você quiser acompanhar."
        actions={
          <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setDraft({ name: '', icon: 'store', color: PLACE_COLORS[(segments?.length ?? 0) % PLACE_COLORS.length] })}>
            Novo
          </Button>
        }
      />
      {!segments || !places ? (
        <ListSkeleton rows={3} />
      ) : (
        <Card className="divide-y divide-line">
          {segments.map((s) => {
            const n = places.filter((p) => p.segmentId === s.id).length;
            return (
              <div key={s.id} className="flex items-center gap-3 py-2.5 pl-4 pr-1">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[30%] text-white" style={{ background: s.color }}>
                  <SegmentIcon icon={s.icon} className="h-5 w-5" />
                </span>
                <Link to={`/lugares?tipo=${s.id}`} className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{s.name}</div>
                  <div className="text-xs text-muted">
                    {n} lugar{n === 1 ? '' : 'es'}
                    {s.mode === 'fuel' ? ' · telas de combustível' : ''}
                  </div>
                </Link>
                <IconButton label={`Editar ${s.name}`} onClick={() => setDraft({ id: s.id, name: s.name, icon: s.icon, color: s.color, builtin: s.builtin, fuel: s.mode === 'fuel' })}>
                  <Pencil className="h-4 w-4" />
                </IconButton>
                {s.builtin ? (
                  <span className="flex h-11 w-11 items-center justify-center text-muted" title="Tipo padrão: pode renomear, não excluir">
                    <Lock className="h-4 w-4" aria-label="Tipo padrão" />
                  </span>
                ) : (
                  <IconButton
                    label={`Excluir ${s.name}`}
                    onClick={async () => {
                      if (!(await confirm({ title: `Excluir o tipo ${s.name}?`, message: 'Categorias e produtos ligados a ele continuam, só ficam sem tipo.', confirmLabel: 'Excluir', danger: true }))) return;
                      try {
                        await deleteSegment(s.id);
                        toast('Tipo excluído');
                      } catch (err) {
                        toast((err as Error).message, 'error');
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                )}
              </div>
            );
          })}
        </Card>
      )}
      <p className="mt-3 text-xs text-muted">Tipos novos funcionam como Mercado e Farmácia: itens com foto opcional, quantidade e preço.</p>

      <Sheet
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Editar tipo' : 'Novo tipo de lugar'}
        footer={
          <Button block onClick={save}>
            Salvar
          </Button>
        }
      >
        {draft && (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <TextField label="Nome" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ex.: Pet shop" maxLength={40} data-autofocus />
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">Ícone</legend>
              <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label="Ícone">
                {Object.entries(SEGMENT_ICONS)
                  .filter(([k]) => draft.fuel || k !== 'fuel')
                  .map(([key, { label }]) => (
                    <button
                      key={key}
                      type="button"
                      role="radio"
                      aria-checked={draft.icon === key}
                      aria-label={label}
                      title={label}
                      onClick={() => setDraft({ ...draft, icon: key })}
                      className={cx(
                        'flex h-11 items-center justify-center rounded-md border transition-colors',
                        draft.icon === key ? 'border-transparent bg-primary text-on-primary' : 'border-line text-muted hover:text-ink',
                      )}
                    >
                      <SegmentIcon icon={key} className="h-5 w-5" />
                    </button>
                  ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">Cor</legend>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cor">
                {PLACE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={draft.color === c}
                    aria-label={`Cor ${c}`}
                    onClick={() => setDraft({ ...draft, color: c })}
                    className={cx('h-9 w-9 rounded-[30%] ring-offset-2 ring-offset-surface', draft.color === c && 'ring-2 ring-ink')}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </fieldset>
          </form>
        )}
      </Sheet>
    </div>
  );
}
