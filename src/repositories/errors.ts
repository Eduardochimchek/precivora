import type { ZodType } from 'zod';
import { firstIssue } from '@/services/schemas';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validate<T>(schema: ZodType<T>, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success) throw new ValidationError(firstIssue(r.error));
  return r.data;
}
