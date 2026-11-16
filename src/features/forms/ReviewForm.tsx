import { useEffect, useState } from 'react';
import { Ban, Heart } from 'lucide-react';
import { db } from '@/db/database';
import type { ID, ReviewTarget } from '@/types';
import { Button, Sheet, StarInput, TextareaField, Toggle, useFeedback } from '@/design-system';
import { deleteReview, getReview, saveReview } from '@/repositories/reviews';

export interface ReviewFormProps {
  open: boolean;
  onClose: () => void;
  targetType: ReviewTarget;
  targetId: ID;
}

export function ReviewForm({ open, onClose, targetType, targetId }: ReviewFormProps) {
  const { toast, confirm } = useFeedback();
  const [name, setName] = useState('');
  const [existingId, setExistingId] = useState<ID>();
  const [overall, setOverall] = useState(0);
  const [quality, setQuality] = useState(0);
  const [value, setValue] = useState(0);
  const [comment, setComment] = useState('');
  const [favorite, setFavorite] = useState(false);
  const [avoid, setAvoid] = useState(false);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(undefined);
    void (async () => {
      const target = targetType === 'product' ? await db.products.get(targetId) : await db.brands.get(targetId);
      setName(target?.name ?? '');
      const r = await getReview(targetType, targetId);
      setExistingId(r?.id);
      setOverall(r?.overall ?? 0);
      setQuality(r?.quality ?? 0);
      setValue(r?.value ?? 0);
      setComment(r?.comment ?? '');
      setFavorite(r?.favorite ?? false);
      setAvoid(r?.avoid ?? false);
    })();
  }, [open, targetType, targetId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!overall) {
      setError('Dê uma nota geral de 1 a 5 estrelas');
      return;
    }
    setSaving(true);
    try {
      await saveReview({ targetType, targetId, overall, quality, value, comment, favorite, avoid });
      toast('Avaliação salva');
      onClose();
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!existingId) return;
    const ok = await confirm({ title: 'Excluir avaliação?', message: `A nota de "${name}" deixa de contar nas sugestões.`, confirmLabel: 'Excluir', danger: true });
    if (!ok) return;
    await deleteReview(existingId);
    toast('Avaliação excluída');
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={targetType === 'product' ? 'Avaliar produto' : 'Avaliar marca'}
      description={<>{name} · avaliação pessoal, fica só no seu aparelho.</>}
      footer={
        <>
          {existingId && (
            <Button variant="ghost" onClick={remove} className="text-danger">
              Excluir
            </Button>
          )}
          <Button type="submit" form="review-form" block loading={saving}>
            Salvar avaliação
          </Button>
        </>
      }
    >
      <form id="review-form" onSubmit={submit} className="flex flex-col gap-3" noValidate>
        <StarInput label="Nota geral" value={overall} onChange={(v) => { setOverall(v); setError(undefined); }} />
        {error && <p className="-mt-2 text-xs font-medium text-danger" role="alert">{error}</p>}
        <StarInput label="Qualidade" optional value={quality} onChange={setQuality} />
        <StarInput label="Custo-benefício" optional value={value} onChange={setValue} />
        <TextareaField
          label="Comentário"
          optional
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={1000}
          placeholder="Ex.: rende bem, não empapa."
          wrapperClassName="mt-2"
        />
        <div className="mt-1 flex flex-col divide-y divide-line rounded-lg border border-line px-4">
          <Toggle
            className="py-3"
            label="Favorito"
            description={<span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" aria-hidden /> Ganha prioridade nas sugestões.</span>}
            checked={favorite}
            onChange={(v) => { setFavorite(v); if (v) setAvoid(false); }}
          />
          <Toggle
            className="py-3"
            label="Não comprar novamente"
            description={<span className="inline-flex items-center gap-1"><Ban className="h-3 w-3" aria-hidden /> Vai para o fim das sugestões, com aviso.</span>}
            checked={avoid}
            onChange={(v) => { setAvoid(v); if (v) setFavorite(false); }}
          />
        </div>
      </form>
    </Sheet>
  );
}
