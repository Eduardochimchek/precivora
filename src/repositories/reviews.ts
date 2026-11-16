import { db } from '@/db/database';
import type { ID, Review, ReviewTarget } from '@/types';
import { newId } from '@/utils/id';
import { nowISO } from '@/utils/date';
import { cleanText } from '@/utils/text';
import { reviewSchema } from '@/services/schemas';
import { validate } from './errors';
import { logActivity } from './activity';

export interface ReviewInput {
  targetType: ReviewTarget;
  targetId: ID;
  overall: number;
  quality?: number;
  value?: number;
  comment?: string;
  favorite: boolean;
  avoid: boolean;
}

export async function getReview(targetType: ReviewTarget, targetId: ID): Promise<Review | undefined> {
  return db.reviews.where('[targetType+targetId]').equals([targetType, targetId]).first();
}

/** Cria ou atualiza a avaliação pessoal do produto/marca (uma por item). */
export async function saveReview(input: ReviewInput): Promise<Review> {
  const prev = await getReview(input.targetType, input.targetId);
  const now = nowISO();
  const review: Review = validate(reviewSchema, {
    id: prev?.id ?? newId(),
    targetType: input.targetType,
    targetId: input.targetId,
    overall: input.overall,
    quality: input.quality || undefined,
    value: input.value || undefined,
    comment: cleanText(input.comment, 1000),
    favorite: input.favorite,
    avoid: input.avoid && !input.favorite,
    date: now,
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
  });
  await db.reviews.put(review);
  const name =
    input.targetType === 'product'
      ? (await db.products.get(input.targetId))?.name
      : (await db.brands.get(input.targetId))?.name;
  await logActivity('review', `${name ?? 'Item'} avaliado com ${review.overall} estrela${review.overall > 1 ? 's' : ''}`, review.id);
  return review;
}

/** Marca/desmarca favorito sem exigir nota (cria avaliação neutra só se ainda não existir nota). */
export async function toggleFlag(targetType: ReviewTarget, targetId: ID, flag: 'favorite' | 'avoid'): Promise<void> {
  const prev = await getReview(targetType, targetId);
  if (!prev) return;
  const next = !prev[flag];
  await db.reviews.update(prev.id, {
    [flag]: next,
    ...(next ? { [flag === 'favorite' ? 'avoid' : 'favorite']: false } : {}),
    updatedAt: nowISO(),
  });
}

export async function deleteReview(id: ID): Promise<void> {
  await db.reviews.delete(id);
}
