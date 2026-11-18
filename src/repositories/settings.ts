import { db } from '@/db/database';
import type { Settings } from '@/types';

export const DEFAULT_SETTINGS: Settings = {
  userName: '',
  theme: 'system',
  flexRatio: 0.7,
  tankSizes: [30, 40, 50],
  tripCost: 8,
  preferSingleStore: false,
  minSplitSavings: 15,
  staleDays: 30,
  monthlyBudget: 0,
  savingsGoal: 0,
  onboardingDone: false,
  checklistHidden: false,
  anpAuto: false,
  autoBackup: false,
  autoBackupDays: 7,
  autoBackupKeep: 4,
};

const OPTIONAL_KEYS = new Set(['lastBackupAt', 'anpCheckedAt', 'anpLatest', 'lastAutoBackupAt', 'lastAutoBackupBytes']);

export async function getSettings(): Promise<Settings> {
  const rows = await db.settings.toArray();
  const s: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) if (r.key in DEFAULT_SETTINGS || OPTIONAL_KEYS.has(r.key)) s[r.key] = r.value;
  return s as unknown as Settings;
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  await db.settings.bulkPut(Object.entries(patch).map(([key, value]) => ({ key: key as keyof Settings, value })));
}
